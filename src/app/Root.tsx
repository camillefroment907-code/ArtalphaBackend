import { Outlet, useLocation } from 'react-router';
import { Header } from './components/Header';
import { LarryChat } from './components/LarryChat';
import { RecommendationPopup } from './components/RecommendationPopup';
import { NPSSurvey } from './components/NPSSurvey';
import { LegalDisclaimer } from './components/LegalDisclaimer';

export default function Root() {
  const location = useLocation();
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
