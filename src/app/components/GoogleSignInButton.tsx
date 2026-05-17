import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { setUser } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface Props {
  onError?: (error: string) => void;
}

export function GoogleSignInButton({ onError }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        auto_select: false,
        callback: async (response: { credential: string }) => {
          try {
            const resp = await fetch(`${BACKEND}/api/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Google sign in failed');

            setUser({
              id: data.user_id,
              email: data.email,
              name: data.email,
              plan: 'free',
              token: data.access_token,
            });

            if (data.is_new_user) {
              localStorage.setItem('nautilus_show_tour', '1');
              navigate('/app/onboarding');
            } else {
              navigate('/app/explore');
            }
          } catch (e: any) {
            onError?.(e?.message || 'Google sign in failed');
          }
        },
      });

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 400,
        });
        setLoaded(true);
      }
    };

    // Check if script already loaded
    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      // Wait for script to load
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div style={{ width: '100%' }}>
      <div ref={buttonRef} style={{ width: '100%', minHeight: '44px' }} />
      {!loaded && (
        <div style={{
          height: '44px', background: 'white', border: '1px solid var(--border)',
          borderRadius: '4px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '10px',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          <span style={{ fontSize: '14px', color: 'var(--text-2)' }}>Continue with Google</span>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window { google: any; }
}
