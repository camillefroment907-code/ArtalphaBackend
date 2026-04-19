import { Outlet, useLocation } from 'react-router';
import { Header } from './components/Header';
import { Larry } from './components/Larry';
import { RecommendationPopup } from './components/RecommendationPopup';
import { NPSSurvey } from './components/NPSSurvey';

export default function Root() {
  const location = useLocation();
  const isOnboarding = location.pathname.startsWith('/app/onboarding');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Outlet />
      {!isOnboarding && <Larry />}
      {!isOnboarding && <RecommendationPopup />}
      <NPSSurvey />
    </div>
  );
}
