import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const ADMIN_KEY = 'hono-admin-2024';
const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Key': ADMIN_KEY,
  Authorization: `Bearer ${getToken()}`,
});

const fmt = (n: number | null | undefined) =>
  n != null ? Math.round(n).toLocaleString('fr-FR') : '—';

const TABS = [
  'Synthèse', 'Users', 'Finance', 'Scraping',
  'Tracking', 'SEO', 'Coûts', 'Data', 'Blog'
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [finance, setFinance] = useState<any>(null);
  const [synthese, setSynthese] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [nps, setNps] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = adminHeaders();
    Promise.all([
      fetch(`${BACKEND}/api/admin/finance`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/costs`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/nps`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/lot-count`, { headers: h }).then(r => r.json()),
    ]).then(([fin, cst, n, lots]) => {
      setFinance(fin);
      setCosts(cst);
      setNps(n);
      setSynthese(lots);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
        {activeTab === 0 && (
          <div>
            {loading ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>Chargement...</div>
            ) : (
              <>
                {/* KPI strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'MRR', value: `€${fmt(finance?.mrr)}`, sub: `ARR €${fmt(finance?.arr)}`, color: '#16A34A' },
                    { label: 'Users payants', value: fmt(finance?.total_paying), sub: `sur ${fmt(finance?.total_paying + 800)} total`, color: 'var(--color-text-primary)' },
                    { label: 'Lots DB', value: fmt(synthese?.total), sub: 'actifs en base', color: 'var(--color-text-primary)' },
                    { label: 'NPS', value: nps?.nps ?? '—', sub: `${nps?.responses ?? 0} réponses`, color: nps?.nps >= 50 ? '#16A34A' : nps?.nps >= 0 ? '#B8922A' : '#C0392B' },
                    { label: 'Coûts/mois', value: `€${fmt(costs?.total_monthly_eur)}`, sub: 'infrastructure', color: '#C0392B' },
                    { label: 'Marge brute', value: `${Math.round(((finance?.mrr ?? 0) - (costs?.total_monthly_eur ?? 0)) / Math.max(finance?.mrr ?? 1, 1) * 100)}%`, sub: `€${fmt((finance?.mrr ?? 0) - (costs?.total_monthly_eur ?? 0))} net`, color: '#16A34A' },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 500, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Objectifs */}
                <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Objectifs du mois</div>
                  {[
                    { label: 'MRR cible €3 000', pct: Math.min(100, Math.round(((finance?.mrr ?? 0) / 3000) * 100)) },
                    { label: 'Users payants cible 100', pct: Math.min(100, Math.round(((finance?.total_paying ?? 0) / 100) * 100)) },
                    { label: 'Lots DB cible 50 000', pct: Math.min(100, Math.round(((synthese?.total ?? 0) / 50000) * 100)) },
                  ].map(({ label, pct }) => (
                    <div key={label} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{label}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: pct >= 80 ? '#16A34A' : pct >= 50 ? '#B8922A' : '#C0392B', fontWeight: 500 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#16A34A' : pct >= 50 ? '#B8922A' : '#C0392B', borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Plans breakdown */}
                <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Répartition plans actifs</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { plan: 'Free', price: '—', color: '#6B7280' },
                      { plan: 'investor', price: '€29/mo', color: '#2563EB' },
                      { plan: 'pro', price: '€49/mo', color: '#16A34A' },
                      { plan: 'institutional', price: '€199/mo', color: '#B8922A' },
                    ].map(({ plan, price, color }) => (
                      <div key={plan} style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, marginBottom: 4 }}>{plan.toUpperCase()}</div>
                        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>{finance?.plan_counts?.[plan] ?? 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
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
