import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';
import { useTranslation } from 'react-i18next';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const { i18n }                = useTranslation();
  const isFr                    = i18n.language?.startsWith('fr');
  const token                   = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit() {
    if (!token) { setError(isFr ? 'Lien invalide ou manquant. Veuillez en demander un nouveau.' : 'Invalid or missing reset token. Please request a new link.'); return; }
    if (password.length < 8) { setError(isFr ? 'Le mot de passe doit contenir au moins 8 caractères.' : 'Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError(isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || (isFr ? 'Une erreur est survenue. Veuillez demander un nouveau lien.' : 'Something went wrong. Please request a new reset link.'));
      } else {
        setDone(true);
        setTimeout(() => navigate('/app/login'), 3000);
      }
    } catch {
      setError(isFr ? 'Impossible de se connecter. Vérifiez votre connexion internet.' : 'Unable to connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#FAFAF8' }}>
      {/* Left panel */}
      <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: 40 }}>
            <Logo variant="wordmark" size={28} />
          </Link>

          {!token ? (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 12px' }}>
                {isFr ? 'Lien invalide' : 'Invalid link'}
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px' }}>
                {isFr ? 'Ce lien de réinitialisation est manquant ou malformé. Veuillez en demander un nouveau.' : 'This reset link is missing or malformed. Please request a new one.'}
              </p>
              <Link to="/forgot-password" style={{ display: 'inline-block', padding: '12px 24px', background: '#1A2A44', color: '#fff', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                {isFr ? 'Demander un nouveau lien' : 'Request new link'}
              </Link>
            </>
          ) : done ? (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 12px' }}>
                {isFr ? 'Mot de passe mis à jour' : 'Password updated'}
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
                {isFr ? 'Votre mot de passe a été modifié. Redirection vers la connexion…' : 'Your password has been changed. Redirecting you to login…'}
              </p>
              <Link to="/app/login" style={{ fontSize: 13, color: '#1A2A44', fontWeight: 600 }}>
                {isFr ? 'Aller à la connexion →' : 'Go to login →'}
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 8px' }}>
                {isFr ? 'Choisir un nouveau mot de passe' : 'Choose a new password'}
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 32px' }}>
                {isFr ? '8 caractères minimum.' : 'Must be at least 8 characters.'}
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1A2A44', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {isFr ? 'NOUVEAU MOT DE PASSE' : 'New password'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={isFr ? 'Min. 8 caractères' : 'Min. 8 characters'}
                    style={{ width: '100%', padding: '12px 44px 12px 14px', border: '1px solid #D1CCC0', borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12 }}>
                    {showPwd ? (isFr ? 'Masquer' : 'Hide') : (isFr ? 'Afficher' : 'Show')}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1A2A44', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {isFr ? 'CONFIRMER LE MOT DE PASSE' : 'Confirm password'}
                </label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder={isFr ? 'Répéter le mot de passe' : 'Repeat password'}
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1CCC0', borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px' }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? '#93a3b4' : '#1A2A44', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.03em' }}
              >
                {loading ? (isFr ? 'Mise à jour…' : 'Updating…') : (isFr ? 'Définir le nouveau mot de passe' : 'Set new password')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: '0 0 42%',
        backgroundImage: 'url(/auth-painting.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          right: 40,
          color: 'white'
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 8
          }}>NAUTILUS · ART MARKET INTELLIGENCE</div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 400,
            lineHeight: 1.3
          }}>{isFr ? <>Votre compte,<br />sécurisé.</> : <>Your account,<br />secured.</>}</div>
        </div>
      </div>
    </div>
  );
}
