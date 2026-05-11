import { useState, useEffect } from 'react';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const ADMIN_KEY = 'hono-admin-2024';
const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Key': ADMIN_KEY,
  Authorization: `Bearer ${getToken()}`,
});

const TABS = [
  'Synthèse', 'Users', 'Finance', 'Scraping',
  'Tracking', 'SEO', 'Coûts', 'Data', 'Blog'
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      {/* Header */}
      <div style={{ background: '#0A1628', padding: '18px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', color: 'rgba(198,168,90,0.7)', marginBottom: 4 }}>
              NAUTILUS · ADMIN
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', fontWeight: 400 }}>
              Dashboard de pilotage
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} style={{
                padding: '6px 14px', fontSize: 11, fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em', border: 'none', borderRadius: 4,
                background: activeTab === i ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: activeTab === i ? 'white' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
        {activeTab === 0 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Synthèse...</div>}
        {activeTab === 1 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Users...</div>}
        {activeTab === 2 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Finance...</div>}
        {activeTab === 3 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Scraping...</div>}
        {activeTab === 4 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Tracking...</div>}
        {activeTab === 5 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>SEO — bientôt disponible</div>}
        {activeTab === 6 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Coûts...</div>}
        {activeTab === 7 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Chargement Data...</div>}
        {activeTab === 8 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Blog — bientôt disponible</div>}
      </div>
    </div>
  );
}
