import { FlowDataProvider } from './context/FlowDataContext.jsx'
import { Layout } from './components/Layout.jsx'
import { Dashboard } from './pages/Dashboard.jsx'

function App() {
  return (
    <FlowDataProvider>
      <Layout />
    </FlowDataProvider>
  )
}

export default App
