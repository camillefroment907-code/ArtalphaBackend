import { Navigate, Outlet } from 'react-router';
import { useEffect } from 'react';
import { getUser } from '../../lib/auth';

const ADMIN_EMAIL = 'camillefroment907@gmail.com';

/** Swaps the favicon to orange while an admin page is mounted. */
function useAdminFavicon() {
  useEffect(() => {
    const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
    const prev: { el: HTMLLinkElement; href: string }[] = [];

    links.forEach(el => {
      prev.push({ el, href: el.href });
      el.href = '/favicon-admin.svg';
    });

    return () => {
      prev.forEach(({ el, href }) => { el.href = href; });
    };
  }, []);
}

export function AdminRoute() {
  useAdminFavicon();
  const user = getUser();

  if (!user) return <Navigate to="/app/login" replace />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/app/today" replace />;

  return <Outlet />;
}
