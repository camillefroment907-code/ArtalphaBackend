import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Header } from './components/Header';
import { LarryChat } from './components/LarryChat';
import { RecommendationPopup } from './components/RecommendationPopup';
import { NPSSurvey } from './components/NPSSurvey';
import { LegalDisclaimer } from './components/LegalDisclaimer';
import { getUser, getToken, setUser } from '../lib/auth';
import { MarketBriefModal } from './components/MarketBriefModal';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// Paths where the verification gate must NOT fire
const VERIFY_EXEMPT = [
  '/app/login',
  '/app/signup',
  '/app/onboarding',
  '/app/verify-email-required',
  '/app/verify-pending',
  '/app/pricing',
  '/app/contact',
  '/app/verify-email',
];

export default function Root() {
  const location = useLocation();
  const navigate  = useNavigate();

  // Sync plan from API on every app load — fixes stale localStorage after admin plan changes
  useEffect(() => {
    const token = getToken();
    const stored = getUser();
    if (!token || !stored) return;
    fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.plan) return;
        if (
          data.plan !== stored.plan ||
          data.trial_active !== stored.trial_active ||
          data.trial_end !== stored.trial_end
        ) {
          setUser({ ...stored, plan: data.plan, trial_end: data.trial_end ?? null, trial_active: data.trial_active ?? false });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const user = getUser();
    if (
      user &&
      user.is_verified === false &&
      !VERIFY_EXEMPT.some(p => location.pathname.startsWith(p))
    ) {
      navigate('/app/verify-email-required', { replace: true });
    }
  }, [location.pathname]);

  // GA4 page view on route change
  useEffect(() => {
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location.pathname]);

  const isOnboarding = location.pathname.startsWith('/app/onboarding');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Outlet />
      {!isOnboarding && <LarryChat />}
      {!isOnboarding && <RecommendationPopup />}
      <NPSSurvey />
      {!isOnboarding && <LegalDisclaimer />}
      {!isOnboarding && <MarketBriefModal />}
    </div>
  );
}
