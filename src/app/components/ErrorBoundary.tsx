import { Component, type ReactNode } from 'react';
import { Logo } from './Logo';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In production, send to error tracking service
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ marginBottom: '32px' }}>
            <Logo variant="horizontal" color="dark" size={28} />
          </div>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--red-subtle)', border: '1px solid var(--red-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: '22px',
          }}>
            ◆
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 700,
            color: 'var(--text)', margin: '0 0 12px',
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7,
            margin: '0 0 32px',
          }}>
            An unexpected error occurred. The Nautilus team has been notified.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-navy"
              style={{ padding: '10px 24px' }}
            >
              Reload page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              style={{
                padding: '10px 24px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              Go home
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '32px', padding: '16px', background: 'var(--bg-subtle)',
              border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '11px', fontFamily: 'var(--font-mono)',
              color: 'var(--red)', textAlign: 'left', overflow: 'auto',
              maxHeight: '200px',
            }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
