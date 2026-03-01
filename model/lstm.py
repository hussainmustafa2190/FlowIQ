import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import pickle
import os
import json

DATA_DIR = r"D:\Henhacks\FlowIQ\FlowIQ\processed"
SAVE_DIR = r"D:\Henhacks\FlowIQ\FlowIQ\model\weights"
os.makedirs(SAVE_DIR, exist_ok=True)

HIDDEN_SIZE = 64
NUM_LAYERS = 2
DROPOUT = 0.2
LEARNING_RATE = 0.001
EPOCHS = 30
BATCH_SIZE = 64
FORECAST_HORIZON = 12

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {DEVICE}")


class FlowIQLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size, dropout):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size)
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        last = out[:, -1, :]
        return self.fc(last)


def train(model, loader, optimizer, criterion):
    model.train()
    total_loss = 0
    for X_batch, y_batch in loader:
        X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
        optimizer.zero_grad()
        pred = model(X_batch)
        loss = criterion(pred, y_batch)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total_loss += loss.item()
    return total_loss / len(loader)


def evaluate(model, loader, criterion):
    model.eval()
    total_loss = 0
    with torch.no_grad():
        for X_batch, y_batch in loader:
            X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
            pred = model(X_batch)
            total_loss += criterion(pred, y_batch).item()
    return total_loss / len(loader)


def run_training():
    print(" Loading processed sequences...")
    X_train = np.load(f"{DATA_DIR}/X_train.npy")
    X_test  = np.load(f"{DATA_DIR}/X_test.npy")
    y_train = np.load(f"{DATA_DIR}/y_train.npy")
    y_test  = np.load(f"{DATA_DIR}/y_test.npy")
    print(f"   X_train: {X_train.shape} | y_train: {y_train.shape}")

    input_size = X_train.shape[2]

    train_ds = TensorDataset(
        torch.FloatTensor(X_train),
        torch.FloatTensor(y_train)
    )
    test_ds = TensorDataset(
        torch.FloatTensor(X_test),
        torch.FloatTensor(y_test)
    )
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False)

    model = FlowIQLSTM(
        input_size=input_size,
        hidden_size=HIDDEN_SIZE,
        num_layers=NUM_LAYERS,
        output_size=FORECAST_HORIZON,
        dropout=DROPOUT
    ).to(DEVICE)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nModel: {total_params:,} parameters")

    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
    criterion = nn.MSELoss()

    print(f"\nTraining for {EPOCHS} epochs...\n")
    best_val_loss = float("inf")
    history = {"train_loss": [], "val_loss": []}

    for epoch in range(1, EPOCHS + 1):
        train_loss = train(model, train_loader, optimizer, criterion)
        val_loss   = evaluate(model, test_loader, criterion)
        scheduler.step(val_loss)

        history["train_loss"].append(round(train_loss, 6))
        history["val_loss"].append(round(val_loss, 6))

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), f"{SAVE_DIR}/flowiq_best.pt")
            tag = " ← best"
        else:
            tag = ""

        if epoch % 5 == 0 or epoch == 1:
            print(f"  Epoch {epoch:03d} | Train: {train_loss:.5f} | Val: {val_loss:.5f}{tag}")

    meta = {
        "input_size": input_size,
        "hidden_size": HIDDEN_SIZE,
        "num_layers": NUM_LAYERS,
        "output_size": FORECAST_HORIZON,
        "dropout": DROPOUT,
        "best_val_loss": round(best_val_loss, 6),
        "epochs_trained": EPOCHS,
    }
    with open(f"{SAVE_DIR}/model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    with open(f"{SAVE_DIR}/history.json", "w") as f:
        json.dump(history, f, indent=2)

    print(f"\nTraining complete!")
    print(f"   Best val loss: {best_val_loss:.5f}")
    print(f"   Weights saved to {SAVE_DIR}/flowiq_best.pt")
    print("   Next step → run: python api/main.py")

    return model, meta


def load_model(weights_path: str, meta_path: str) -> FlowIQLSTM:
    with open(meta_path) as f:
        meta = json.load(f)
    model = FlowIQLSTM(
        input_size=meta["input_size"],
        hidden_size=meta["hidden_size"],
        num_layers=meta["num_layers"],
        output_size=meta["output_size"],
        dropout=meta["dropout"]
    )
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model.eval()
    return model


def predict(model, sequence: np.ndarray, scaler) -> dict:
    x = torch.FloatTensor(sequence).unsqueeze(0)
    with torch.no_grad():
        raw = model(x).squeeze().numpy()

    dummy = np.zeros((len(raw), scaler.n_features_in_))
    dummy[:, 0] = raw
    scores = scaler.inverse_transform(dummy)[:, 0]
    scores = np.clip(scores, 0, 100)

    steps = []
    for i, score in enumerate(scores):
        steps.append({
            "minutes_ahead": (i + 1) * 15,
            "congestion_score": round(float(score), 1),
            "level": (
                "CRITICAL" if score > 75 else
                "HIGH"     if score > 50 else
                "NORMAL"   if score > 25 else
                "LOW"
            )
        })

    return {
        "forecast": steps,
        "peak_score": round(float(max(scores)), 1),
        "peak_at_minutes": int((np.argmax(scores) + 1) * 15),
        "alert": max(scores) > 75
    }


if __name__ == "__main__":
    run_training()
