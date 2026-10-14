import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { reportClientError } from './api'
import './index.css'

class ApplicationErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportClientError({
      kind: 'render',
      message: error.message,
      stack: [error.stack, errorInfo.componentStack].filter(Boolean).join('\n'),
    })
  }

  render() {
    if (this.state.failed) {
      return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#F8FAFC', fontFamily: 'Arial, Helvetica, sans-serif', color: '#172033' }}>
        <section style={{ width: '100%', maxWidth: '480px', borderRadius: '20px', background: '#FFFFFF', padding: '36px', boxShadow: '0 18px 48px rgba(31, 53, 88, 0.14)', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#667085', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em' }}>CLICK &amp; EARN</p>
          <h1 style={{ margin: '12px 0', color: '#1F3558', fontSize: '24px' }}>We could not display this page</h1>
          <p style={{ margin: '0 0 24px', color: '#667085', fontSize: '15px', lineHeight: 1.55 }}>The issue was recorded safely. Reload the page to continue; your saved payout details have not been changed.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: '44px', border: 0, borderRadius: '10px', padding: '12px 18px', background: '#1F3558', color: '#FFFFFF', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}>Reload page</button>
        </section>
      </main>
    }

    return this.props.children
  }
}

window.addEventListener('error', (event) => {
  const error = event.error instanceof Error ? event.error : undefined
  reportClientError({ kind: 'error', message: error?.message || event.message || 'Uncaught client error', stack: error?.stack })
})

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : undefined
  reportClientError({ kind: 'unhandled_rejection', message: error?.message || String(event.reason || 'Unhandled promise rejection'), stack: error?.stack })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApplicationErrorBoundary><App /></ApplicationErrorBoundary>
  </React.StrictMode>,
)
