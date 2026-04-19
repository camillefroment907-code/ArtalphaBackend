import { Outlet } from 'react-router';
import { Header } from './components/Header';
import { Larry } from './components/Larry';
import { RecommendationPopup } from './components/RecommendationPopup';
import { NPSSurvey } from './components/NPSSurvey';

export default function Root() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Outlet />
      <Larry />
      <RecommendationPopup />
      <NPSSurvey />
    </div>
  );
}
