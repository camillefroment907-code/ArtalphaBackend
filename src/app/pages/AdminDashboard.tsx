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

const planColor = (p: string) =>
  p === 'institutional' ? '#B8922A' : p === 'pro' ? '#16A34A' :
  p === 'investor' ? '#2563EB' : '#6B7280';

const exportCSV = (data: any[], filename: string) => {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename; a.click();
};

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
  const [users, setUsers] = useState<any[]>([]);
  const [tracking, setTracking] = useState<any>(null);
  const [dataQuality, setDataQuality] = useState<any>(null);

  const handleUpgradePlan = async (userId: string, newPlan: string) => {
    await fetch(`${BACKEND}/api/admin/users/${userId}/plan`, {
      method: 'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ plan: newPlan })
    });
    const r = await fetch(`${BACKEND}/api/admin/users?limit=200`, { headers: adminHeaders() });
    const d = await r.json();
    setUsers(d.users || []);
  };

  const handleRevoke = async (userId: string, email: string) => {
    if (!window.confirm(`Révoquer l'abonnement de ${email} ?`)) return;
    await fetch(`${BACKEND}/api/admin/users/${userId}/revoke`, {
      method: 'PATCH', headers: adminHeaders()
    });
    const r = await fetch(`${BACKEND}/api/admin/users?limit=200`, { headers: adminHeaders() });
    const d = await r.json();
    setUsers(d.users || []);
  };

  useEffect(() => {
    const h = adminHeaders();
    Promise.all([
      fetch(`${BACKEND}/api/admin/finance`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/costs`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/nps`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/lot-count`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/users?limit=200`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/tracking`, { headers: h }).then(r => r.json()),
      fetch(`${BACKEND}/api/admin/data-quality`, { headers: h }).then(r => r.json()),
    ]).then(([fin, cst, n, lots, usr, trk, dq]) => {
      setFinance(fin);
      setCosts(cst);
      setNps(n);
      setSynthese(lots);
      setLoading(false);
      setUsers(usr?.users || []);
      setTracking(trk);
      setDataQuality(dq);
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
        {activeTab === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {users.length} users · hors comptes internes
              </div>
              <button onClick={() => exportCSV(users, 'nautilus_users.csv')}
                style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '6px 14px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                ↓ Export CSV
              </button>
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
                    {['Email', 'Plan', 'Inscrit', 'Statut', 'Fin abonnement', 'Actions'].map(col => (
                      <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-primary)' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 3, background: `${planColor(u.plan)}22`, color: planColor(u.plan) }}>
                          {u.plan || 'free'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, color: u.subscription_status === 'ACTIVE' ? '#16A34A' : '#B8922A' }}>
                          {u.subscription_status || 'free'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontSize: 11 }}>
                        {u.subscription_end ? new Date(u.subscription_end).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <select onChange={e => e.target.value && handleUpgradePlan(u.id, e.target.value)}
                            defaultValue=""
                            style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 8px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 3, background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                            <option value="" disabled>↑ Plan</option>
                            {['free','investor','pro','family_office','institutional'].map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <button onClick={() => handleRevoke(u.id, u.email)}
                            style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 10px', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 3, background: 'rgba(192,57,43,0.05)', color: '#C0392B', cursor: 'pointer' }}>
                            Révoquer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 2 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'MRR', value: `€${fmt(finance?.mrr)}`, color: '#16A34A' },
                { label: 'ARR', value: `€${fmt(finance?.arr)}`, color: '#16A34A' },
                { label: 'Users payants', value: fmt(finance?.total_paying), color: 'var(--color-text-primary)' },
                { label: 'Total inscrits', value: fmt(finance?.total_users), color: 'var(--color-text-primary)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Répartition plans actifs</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    {['Plan', 'Abonnés', 'Prix/mois', 'MRR partiel'].map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: 'investor', price: 29, color: '#2563EB' },
                    { plan: 'pro', price: 49, color: '#16A34A' },
                    { plan: 'institutional', price: 199, color: '#B8922A' },
                  ].map(({ plan, price, color }) => {
                    const count = finance?.plan_counts?.[plan] ?? 0;
                    return (
                      <tr key={plan} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 3, background: `${color}22`, color }}>{plan}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{count}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>€{price}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#16A34A' }}>€{fmt(count * price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 3 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Lots total', value: fmt(synthese?.total), color: 'var(--color-text-primary)' },
                { label: 'Deals', value: fmt(synthese?.deals), color: '#16A34A' },
                { label: 'Scorés', value: `${synthese?.score_pct ?? 0}%`, color: '#2563EB' },
                { label: 'Avec image', value: `${synthese?.image_pct ?? 0}%`, color: '#B8922A' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Lots par connecteur</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    {['Source', 'Lots', '% du total'].map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(synthese?.by_source ?? {})
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([source, count]) => (
                      <tr key={source} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{source}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{fmt(count as number)}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          {synthese?.total ? `${((count as number) / synthese.total * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 4 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Événements 30j', value: fmt(tracking?.total_events_30d), color: 'var(--color-text-primary)' },
                { label: 'Maisons trackées', value: fmt(tracking?.auction_house_clicks?.length), color: '#2563EB' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Clics modal revente — 30 derniers jours</div>
              {tracking?.auction_house_clicks?.length ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      {['Maison', 'Type d\'événement', 'Clics'].map(col => (
                        <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tracking.auction_house_clicks.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)' }}>{row.house || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{row.event_type}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#2563EB' }}>{row.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', padding: '20px 0' }}>Aucun clic enregistré sur les 30 derniers jours.</div>
              )}
            </div>
          </div>
        )}
        {activeTab === 5 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>SEO — bientôt disponible</div>}
        {activeTab === 6 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Coûts totaux/mois', value: `€${fmt(costs?.total_monthly_eur)}`, color: '#C0392B' },
                { label: 'Marge brute', value: `€${fmt((finance?.mrr ?? 0) - (costs?.total_monthly_eur ?? 0))}`, color: (finance?.mrr ?? 0) > (costs?.total_monthly_eur ?? 0) ? '#16A34A' : '#C0392B' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Détail des coûts</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    {['Outil', 'Catégorie', 'Coût/mois'].map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(costs?.costs ?? []).map((c: any) => (
                    <tr key={c.tool} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)' }}>{c.tool}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 3, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>{c.category}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#C0392B' }}>€{c.cost_eur}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid var(--color-border-tertiary)' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#C0392B' }}>€{fmt(costs?.total_monthly_eur)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 7 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Lots total', value: fmt(dataQuality?.total_lots), color: 'var(--color-text-primary)' },
                { label: 'Avec image', value: `${dataQuality?.with_image_pct ?? 0}%`, color: (dataQuality?.with_image_pct ?? 0) >= 80 ? '#16A34A' : '#B8922A' },
                { label: 'Avec catégorie', value: `${dataQuality?.with_category_pct ?? 0}%`, color: (dataQuality?.with_category_pct ?? 0) >= 80 ? '#16A34A' : '#B8922A' },
                { label: 'Lots live', value: fmt(dataQuality?.live_lots), color: '#2563EB' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Qualité des données</div>
              {[
                { label: 'Image coverage', pct: dataQuality?.with_image_pct ?? 0, detail: `${fmt(dataQuality?.with_image)} / ${fmt(dataQuality?.total_lots)} lots` },
                { label: 'Catégorie coverage', pct: dataQuality?.with_category_pct ?? 0, detail: `${fmt(dataQuality?.with_category)} / ${fmt(dataQuality?.total_lots)} lots` },
              ].map(({ label, pct, detail }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: pct >= 80 ? '#16A34A' : '#B8922A' }}>{pct}% — {detail}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#16A34A' : '#B8922A', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 8 && <div style={{ color: '#666', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Blog — bientôt disponible</div>}
      </div>
    </div>
  );
}
