import { Outlet } from 'react-router';
import { Header } from './components/Header';
import { Larry } from './components/Larry';

export default function Root() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Outlet />
      <Larry />
    </div>
  );
}
