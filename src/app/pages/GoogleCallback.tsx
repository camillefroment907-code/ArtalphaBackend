import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { setUser } from '../../lib/auth';

export default function GoogleCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('token');
    const user_id = p.get('user_id');
    const email = p.get('email');
    const plan = p.get('plan') ?? 'free';
    const is_new_user = p.get('is_new_user') === '1';

    if (!token || !email) {
      navigate('/app/login?error=google_failed', { replace: true });
      return;
    }

    setUser({
      id: user_id ?? '',
      email,
      name: email,
      plan: plan as any,
      token,
      trial_end: null,
      trial_active: false,
    });

    if (is_new_user) {
      localStorage.setItem('nautilus_show_tour', '1');
      navigate('/app/onboarding', { replace: true });
    } else {
      navigate('/app/explore', { replace: true });
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#FAFAF8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
        Connexion en cours…
      </div>
    </div>
  );
}
