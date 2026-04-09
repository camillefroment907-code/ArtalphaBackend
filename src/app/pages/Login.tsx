import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { Logo } from '../components/Logo';
import { loginApi } from '../../lib/api';
import { setUser } from '../../lib/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      setUser({
        id: res.user_id,
        email: res.email,
        name: res.name,
        plan: (res.plan ?? 'free') as any,
        token: res.access_token,
      });
      navigate('/app/opportunities');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: '#FAFAF8',
    }}>
      {/* Left — form */}
      <div style={{
        width: '50%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 64px',
        overflowY: 'auto',
      }}>
        <div style={{ marginBottom: '40px' }}>
          <Link to="/">
            <Logo variant="horizontal" color="dark" size={26} />
          </Link>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 600, color: '#1A1614', marginBottom: '6px' }}>
          Welcome Back
        </h1>
        <p style={{ fontSize: '13px', color: '#6B6B6B', marginBottom: '36px' }}>
          Log in to your account to view opportunities
        </p>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7355', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '1px solid #E8E6E0', background: '#FFFFFF', color: '#1A1614', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#8B7355')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E6E0')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7355', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 16px', fontSize: '14px', border: '1px solid #E8E6E0', background: '#FFFFFF', color: '#1A1614', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#8B7355')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E6E0')}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '14px', background: '#1A1A1A', color: '#FAFAF8', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#000'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#1A1A1A'; }}
          >
            {loading ? 'LOGGING IN…' : 'LOG IN'}
          </button>
        </form>

        <p style={{ marginTop: '28px', textAlign: 'center', fontSize: '12px', color: '#6B6B6B' }}>
          Don't have an account?{' '}
          <Link to="/app/signup" style={{ color: '#8B7355', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Sign up
          </Link>
        </p>
      </div>

      {/* Right — image */}
      <div style={{
        width: '50%',
        backgroundImage: 'url(https://images.unsplash.com/photo-1720727226875-44a17a151320?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,22,20,0.35)' }} />
        <div style={{ position: 'absolute', bottom: '64px', left: '48px', right: '48px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)', marginBottom: '12px', textTransform: 'uppercase' }}>
            Today's Opportunity
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '48px', fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>
            +102%
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginTop: '8px' }}>
            Expected YoY · Detected 14 days ago
          </div>
        </div>
      </div>
    </div>
  );
}
