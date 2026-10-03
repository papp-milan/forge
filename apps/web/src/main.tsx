import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Forge UI crashed', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center p-8">
          <section className="max-w-md text-center">
            <h1 className="text-2xl font-semibold">Forge HQ encountered an error.</h1>
            <p className="mt-2 text-sm opacity-70">Reload the dashboard to recover the current session.</p>
            <button className="mt-5 rounded-lg border px-4 py-2" onClick={() => window.location.reload()}>
              Reload HQ
            </button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
