import { Component, ReactNode } from 'react'
import { NavigateFunction } from 'react-router-dom'

interface Props {
  children: ReactNode
  navigate: NavigateFunction
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.navigate('/error?type=custom&message=Application%20crashed')
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}
