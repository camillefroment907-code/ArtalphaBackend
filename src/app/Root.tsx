import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Header } from './components/Header';
import { LarryChat } from './components/LarryChat';
import { RecommendationPopup } from './components/RecommendationPopup';
import { NPSSurvey } from './components/NPSSurvey';
import { LegalDisclaimer } from './components/LegalDisclaimer';
import { getUser } from '../lib/auth';

// Paths where the verification gate must NOT fire
const VERIFY_EXEMPT = [
  '/app/login',
  '/app/signup',
  '/app/onboarding',
  '/app/verify-email-required',
  '/app/verify-pending',
  '/app/pricing',
  '/app/contact',
];

export default function Root() {
  const location = useLocation();
  const navigate  = useNavigate();

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

  const isOnboarding = location.pathname.startsWith('/app/onboarding');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Outlet />
      {!isOnboarding && <LarryChat />}
      {!isOnboarding && <RecommendationPopup />}
      <NPSSurvey />
      {!isOnboarding && <LegalDisclaimer />}
    </div>
  );
}
