
  import { createRoot } from "react-dom/client";
  import './i18n';
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  // Prefetch critical API data after first paint
  const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
  const PREFETCH_KEY = 'explore_lots_prefetch';
  requestIdleCallback(() => {
    const stored = localStorage.getItem(PREFETCH_KEY);
    if (stored) {
      try {
        const { ts } = JSON.parse(stored);
        if (Date.now() - ts < 5 * 60 * 1000) return; // fresh — skip
      } catch { /* ignore */ }
    }
    fetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&min_score=60&page_size=24`)
      .then(r => r.json())
      .then(data => {
        localStorage.setItem(PREFETCH_KEY, JSON.stringify({ data: { items: data.items || data, total: data.total, pages: data.pages }, ts: Date.now() }));
        // Also store under the key Explore.tsx will look for
        const exploreKey = `explore_lots_${JSON.stringify({ page: 1, page_size: 24, sort_by: 'deal_score', sort_dir: 'desc', min_score: 60 })}`;
        localStorage.setItem(exploreKey, JSON.stringify({ data: { items: data.items || data, total: data.total, pages: data.pages }, ts: Date.now() }));
      })
      .catch(() => { /* silent fail */ });
  });
