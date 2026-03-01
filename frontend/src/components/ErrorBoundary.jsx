import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 flex items-center justify-center min-h-[200px] text-[#8b949e] text-sm">
          Something went wrong. Please try again.
        </div>
      )
    }
    return this.props.children
  }
}
