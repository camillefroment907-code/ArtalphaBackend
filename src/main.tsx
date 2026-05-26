import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>
);

// Wake up backend + prefetch critical data immediately after render
const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
function _getStoredToken(): string {
  try { return JSON.parse(localStorage.getItem('artalpha_auth') || '{}')?.token ?? ''; } catch { return ''; }
}
setTimeout(() => {
  const token = _getStoredToken();
  const h = token ? { Authorization: `Bearer ${token}` } : undefined;
  fetch(`${BACKEND}/health`).catch(() => {});
  if (token) {
    fetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&min_score=60&page_size=24`, { headers: h })
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items || data.lots || []);
        if (items.length > 0) {
          try { sessionStorage.setItem('lots_best', JSON.stringify({ items, total: data.total })); } catch { /* quota */ }
        }
      })
      .catch(() => {});
  }
  fetch(`${BACKEND}/api/market/sentiment`, { headers: h })
    .then(r => r.json())
    .then(data => { try { sessionStorage.setItem('sentiment', JSON.stringify(data)); } catch { /* quota */ } })
    .catch(() => {});
}, 100);
