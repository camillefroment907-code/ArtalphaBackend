import { Navigate, Outlet } from 'react-router';
import { isAuthenticated, getUser } from '../../lib/auth';

export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/app/login" replace />;
  }
  const user = getUser();
  if (user && user.is_verified === false) {
    return <Navigate to="/app/verify-pending" replace />;
  }
  return <Outlet />;
}
