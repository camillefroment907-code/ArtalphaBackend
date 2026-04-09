import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { getUser, getPlanLimits, getToken, logout, PLAN_LIMITS } from '../../lib/auth';
import { AlertsContent } from './Alerts';
import { getSubscription } from '../../lib/api';
import { getUsageStatus, PLAN_LIMITS as USAGE_LIMITS } from '../../lib/analysisUsage';

// ── Types ────────────────────────────────────────────────────
interface MappedLot {
  id: string;
  artistName: string;
  title: string;
  imageUrl: string;
  price: string;
  estimateLow: number;
  estimateLowFmt: string;
  dealScore: number;
  upsidePercent: number;
  auctionDate: string;
  source: string;
  platform: string;
}

interface SubData {
  plan: string;
  status: string;
  billing_interval?: string;
  current_period_end?: string;
}

interface PortfolioStats {
  total_invested: number;
  total_items: number;
  items_with_valuation: number;
  estimated_total_value: number;
  gain_pct: number;
}

interface PortfolioItem {
  id: string;
  title: string;
  artist_name: string | null;
  medium: string | null;
  dimensions: string | null;
  image_url: string | null;
  purchase_price_eur: number;
  purchase_date: string | null;
  estimated_current_value_eur: number | null;
  notes: string | null;
  is_for_sale: boolean;
  asking_price_eur: number | null;
  gain_pct: number | null;
  created_at: string | null;
}

interface AddForm {
  title: string;
  artist_name: string;
  purchase_price_eur: string;
  purchase_date: string;
  medium: string;
  notes: string;
}

interface EditForm {
  title: string;
  artist_name: string;
  purchase_price_eur: string;
  estimated_current_value_eur: string;
  medium: string;
  notes: string;
}

// ── Helpers ──────────────────────────────────────────────────
function fmt(v: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(v);
}

function mapLot(lot: any): MappedLot {
  const price = lot.current_price || lot.estimate_low || 0;
  const estimateLow = lot.estimate_low || 0;
  const currency = lot.currency || 'EUR';
  return {
    id: String(lot.id),
    artistName: lot.artist_name_raw?.trim() || 'Unknown Artist',
    title: lot.title || 'Untitled',
    imageUrl: lot.image_url || '',
    price: price ? fmt(price, currency) : 'Prix sur demande',
    estimateLow,
    estimateLowFmt: estimateLow ? fmt(estimateLow, currency) : '',
    dealScore: lot.deal_score || 0,
    upsidePercent: Math.round(lot.pct_below_low_estimate || 0),
    auctionDate: lot.auction_date || '',
    source: lot.source || '',
    platform: lot.auction_house_name?.split('—')[0].trim() || lot.source || '',
  };
}

// ── Skeleton Card ────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ paddingTop: '75%', position: 'relative' }} />
      <div style={{ padding: '14px 16px' }}>
        <div className="skeleton" style={{ height: '10px', width: '55%', borderRadius: '4px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '14px', width: '85%', borderRadius: '4px', marginBottom: '10px' }} />
        <div className="skeleton" style={{ height: '18px', width: '40%', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

// ── AlphaCard ────────────────────────────────────────────────
function AlphaCard({ lot, onClick }: { lot: MappedLot; onClick: () => void }) {
  const ds = lot.dealScore;
  const tier = ds >= 80 ? 'EXCEPTIONAL' : ds >= 65 ? 'STRONG' : 'INTERESTING';
  const tierColor = tier === 'EXCEPTIONAL' ? '#C0392B' : tier === 'STRONG' ? 'var(--navy)' : 'var(--gold-dim)';
  const tierBg = tier === 'EXCEPTIONAL' ? 'rgba(192,57,43,0.08)' : tier === 'STRONG' ? 'rgba(26,42,68,0.08)' : 'rgba(198,168,90,0.06)';

  return (
    <div
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = '0 12px 40px rgba(0,0,0,0.1)';
        el.style.borderColor = 'rgba(26,42,68,0.2)';
        const img = el.querySelector('img') as HTMLImageElement | null;
        if (img) img.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
        el.style.borderColor = 'var(--border)';
        const img = el.querySelector('img') as HTMLImageElement | null;
        if (img) img.style.transform = 'scale(1)';
      }}
      style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: '10px',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* Image + badges */}
      <div style={{ position: 'relative', paddingTop: '75%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {lot.imageUrl ? (
          <img
            src={lot.imageUrl} alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center top',
              transition: 'transform 0.5s ease',
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--border)' }}>◇</span>
          </div>
        )}

        {/* Tier badge */}
        <div style={{
          position: 'absolute', top: '10px', left: '10px',
          padding: '4px 10px',
          background: tierBg,
          border: `1px solid ${tierColor}40`,
          borderRadius: '4px',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: tierColor, letterSpacing: '0.1em' }}>{tier}</span>
        </div>

        {/* Score badge */}
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          padding: '4px 8px',
          background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(4px)',
          borderRadius: '4px', border: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)' }}>{Math.round(ds)}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-3)' }}>/100</span>
        </div>

        {/* Bottom fade */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(250,250,248,0.9), transparent)' }} />
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        {lot.artistName !== 'Unknown Artist' && (
          <div style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--navy)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lot.artistName}
          </div>
        )}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)',
          marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.title}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              {lot.price}
            </div>
            {lot.estimateLow > 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                est. {lot.estimateLowFmt}
              </div>
            )}
          </div>
          {lot.upsidePercent > 5 && (
            <div style={{ padding: '3px 8px', background: 'rgba(26,42,68,0.08)', border: '1px solid rgba(26,42,68,0.15)', borderRadius: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)' }}>
                +{lot.upsidePercent}% upside
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
            {lot.platform}
          </span>
          {lot.auctionDate && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', flexShrink: 0 }}>
              {new Date(lot.auctionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Feature row ──────────────────────────────────────────────
function FeatureRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: active ? 'var(--navy)' : 'var(--text-3)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Portfolio() {
  const navigate = useNavigate();
  const user = getUser();
  const plan = user?.email === 'camillefroment907@gmail.com' ? 'elite' : (user?.plan ?? 'free');
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const usageLimit = USAGE_LIMITS[plan] ?? 0;
  const usageStatus = getUsageStatus(plan);

  const [sub, setSub] = useState<SubData | null>(null);
  const [lots, setLots] = useState<MappedLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotsError, setLotsError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  // Portfolio state
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ title: '', artist_name: '', purchase_price_eur: '', purchase_date: '', medium: '', notes: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', artist_name: '', purchase_price_eur: '', estimated_current_value_eur: '', medium: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Plan display label
  const PLAN_LABELS: Record<string, string> = {
    free: 'Free', starter: 'Collector', investor: 'Investor',
    pro: 'Family Office', elite: 'Institutional',
  };
  const planLabel = PLAN_LABELS[plan] ?? plan;

  // Load subscription
  useEffect(() => {
    getSubscription().then(setSub).catch(() => setSub({ plan, status: 'active' }));
  }, [plan]);

  // Load lots
  useEffect(() => {
    const token = getToken();
    setLotsLoading(true);
    fetch('/api/lots?sort_by=deal_score&sort_dir=desc&page_size=12', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        const items: any[] = Array.isArray(data) ? data : (data.items || []);
        setLots(items.map(mapLot));
        setLotsLoading(false);
      })
      .catch(err => {
        setLotsError(err.message || 'Failed to load opportunities');
        setLotsLoading(false);
      });
  }, []);

  // Load portfolio
  useEffect(() => {
    loadPortfolio();
  }, []);

  function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async function loadPortfolio() {
    setPortfolioLoading(true);
    try {
      const [statsRes, itemsRes] = await Promise.all([
        fetch('/api/portfolio/stats', { headers: authHeaders() }),
        fetch('/api/portfolio/items', { headers: authHeaders() }),
      ]);
      if (statsRes.ok) setPortfolioStats(await statsRes.json());
      if (itemsRes.ok) setPortfolioItems(await itemsRes.json());
    } catch {
      // silently fail — portfolio section shows empty state
    } finally {
      setPortfolioLoading(false);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.title || !addForm.purchase_price_eur) return;
    setAddLoading(true);
    setAddError('');
    try {
      const res = await fetch('/api/portfolio/items', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: addForm.title,
          artist_name: addForm.artist_name || null,
          purchase_price_eur: parseFloat(addForm.purchase_price_eur),
          purchase_date: addForm.purchase_date || null,
          medium: addForm.medium || null,
          notes: addForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAddForm({ title: '', artist_name: '', purchase_price_eur: '', purchase_date: '', medium: '', notes: '' });
      setShowAddForm(false);
      await loadPortfolio();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add artwork');
    } finally {
      setAddLoading(false);
    }
  }

  function startEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      artist_name: item.artist_name || '',
      purchase_price_eur: String(item.purchase_price_eur),
      estimated_current_value_eur: item.estimated_current_value_eur ? String(item.estimated_current_value_eur) : '',
      medium: item.medium || '',
      notes: item.notes || '',
    });
  }

  async function handleSaveEdit(itemId: string) {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/portfolio/items/${itemId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          title: editForm.title || undefined,
          artist_name: editForm.artist_name || null,
          purchase_price_eur: editForm.purchase_price_eur ? parseFloat(editForm.purchase_price_eur) : undefined,
          estimated_current_value_eur: editForm.estimated_current_value_eur ? parseFloat(editForm.estimated_current_value_eur) : null,
          medium: editForm.medium || null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingId(null);
      await loadPortfolio();
    } catch {
      // keep edit form open on error
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    setDeletingId(itemId);
    try {
      await fetch(`/api/portfolio/items/${itemId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await loadPortfolio();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  function handleSignOut() {
    logout();
    navigate('/');
  }

  const billingInterval = sub?.billing_interval || 'monthly';
  const isFreePlan = plan === 'free' || plan === 'starter';

  type PortfolioTab = 'portfolio' | 'alerts' | 'abonnement';
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>('portfolio');

  const PORTFOLIO_TABS: { id: PortfolioTab; label: string }[] = [
    { id: 'portfolio',   label: 'Mon Portfolio' },
    { id: 'alerts',      label: 'Mes Alertes'   },
    { id: 'abonnement',  label: 'Abonnement'    },
  ];

  // Input style helper
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div className="page" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

        {/* ── 1. PAGE HEADER ─────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '40px 0 32px',
          borderBottom: '2px solid var(--border)',
        }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Portfolio
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.email && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
                {user.email}
              </span>
            )}
            <span style={{
              padding: '4px 12px', borderRadius: '4px',
              background: 'rgba(198,168,90,0.12)', border: '1px solid var(--gold-border)',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
              color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {planLabel}
            </span>
            {isFreePlan && (
              <Link to="/app/pricing" style={{
                padding: '8px 16px', background: 'var(--gold)', color: 'white',
                borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
              }}>
                Upgrade
              </Link>
            )}
            <button
              onClick={handleSignOut}
              style={{
                padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)',
                borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)',
                cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ── TAB BAR ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: '2px solid var(--border)',
          marginBottom: '32px', gap: '0',
        }}>
          {PORTFOLIO_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPortfolioTab(id)}
              style={{
                padding: '10px 20px', background: 'transparent', border: 'none',
                borderBottom: portfolioTab === id ? '2px solid var(--navy)' : '2px solid transparent',
                marginBottom: '-2px', cursor: 'pointer',
                fontSize: '13px', fontWeight: portfolioTab === id ? 600 : 400,
                color: portfolioTab === id ? 'var(--navy)' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── ALERTS TAB ─────────────────────────────────────── */}
        {portfolioTab === 'alerts' && <AlertsContent />}

        {/* ── ABONNEMENT TAB ─────────────────────────────────── */}
        {portfolioTab === 'abonnement' && (
          <div>
            {/* Plan features */}
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 24px' }}>
              Your Plan — {planLabel}
            </h2>
            <div style={{ background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: '10px', padding: '28px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px' }}>
              <div>
                <FeatureRow label="Opportunities" value={limits.maxOpportunities >= 9999 ? 'Unlimited' : String(limits.maxOpportunities)} active={true} />
                <FeatureRow label="AI Analyses / month" value={usageLimit === 0 ? '—' : usageLimit >= 999 ? 'Unlimited' : String(usageLimit)} active={usageLimit > 0} />
                <FeatureRow label="Investment Analysis" value={limits.hasFullAnalysis ? '✓' : '—'} active={limits.hasFullAnalysis} />
                <FeatureRow label="AI Investment Advisor" value={limits.hasAIVerdict ? '✓' : '—'} active={limits.hasAIVerdict} />
              </div>
              <div>
                <FeatureRow label="Price Projections" value={limits.projectionYears.length > 0 ? limits.projectionYears.map((y: number) => `${y}y`).join(', ') : '—'} active={limits.projectionYears.length > 0} />
                <FeatureRow label="Real-time Alerts" value={limits.hasAlerts ? '✓' : '—'} active={limits.hasAlerts} />
                <FeatureRow label="Portfolio Tracking" value={limits.hasPortfolio ? '✓' : '—'} active={limits.hasPortfolio} />
                <FeatureRow label="Full Artist Profiles" value={limits.hasFullArtistProfile ? '✓' : '—'} active={limits.hasFullArtistProfile} />
              </div>
            </div>
            {isFreePlan && (
              <div style={{ marginTop: '24px', background: 'var(--navy)', borderRadius: '10px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: 'white', margin: '0 0 8px' }}>Unlock the full platform</h3>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0, maxWidth: '420px' }}>Get unlimited opportunities, AI analyses, price projections, and real-time alerts.</p>
                </div>
                <Link to="/app/pricing" style={{ padding: '14px 28px', background: 'var(--gold)', color: 'white', borderRadius: '7px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', flexShrink: 0, marginLeft: '32px' }}>
                  Upgrade Now
                </Link>
              </div>
            )}
            {/* Danger zone */}
            <div style={{ marginTop: '40px', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px', padding: '28px 32px', background: 'rgba(192,57,43,0.02)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#C0392B', margin: '0 0 8px' }}>Danger Zone</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 20px' }}>Permanently delete your account and all associated data.</p>
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(192,57,43,0.4)', borderRadius: '6px', color: '#C0392B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Delete Account
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>Type <strong>DELETE</strong> to confirm:</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="DELETE" style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)', background: 'var(--bg-card)', color: 'var(--text)', outline: 'none', width: '160px' }} />
                    <button disabled={deleteInput !== 'DELETE'} style={{ padding: '10px 20px', background: deleteInput === 'DELETE' ? '#C0392B' : 'var(--bg-subtle)', border: 'none', borderRadius: '6px', color: deleteInput === 'DELETE' ? 'white' : 'var(--text-3)', fontSize: '12px', fontWeight: 600, cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed', letterSpacing: '0.04em', textTransform: 'uppercase' }} onClick={() => { if (deleteInput === 'DELETE') { logout(); navigate('/'); } }}>
                      Confirm Delete
                    </button>
                    <button onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PORTFOLIO TAB ──────────────────────────────────── */}
        {portfolioTab === 'portfolio' && <>

        {/* ── 2. ACCOUNT OVERVIEW STRIP ──────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
          background: 'var(--border)', border: '2px solid var(--border)',
          marginTop: '32px', borderRadius: '10px', overflow: 'hidden',
        }}>
          {/* Plan tile */}
          <div style={{ background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>Plan</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
              {planLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot" />
              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>Active</span>
            </div>
          </div>

          {/* Billing tile */}
          <div style={{ background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>Billing</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', textTransform: 'capitalize' }}>
              {billingInterval}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Next renewal: —</div>
          </div>

          {/* AI Analyses tile */}
          <div style={{ background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>AI Analyses</div>
            {usageLimit > 0 ? (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                  {usageStatus.used}
                  <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 400 }}> / {usageLimit}</span>
                </div>
                <div style={{ height: '4px', background: 'var(--bg-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, usageStatus.percentUsed)}%`,
                    background: 'linear-gradient(to right, var(--navy), var(--gold))',
                    borderRadius: '2px', transition: 'width 0.4s ease',
                  }} />
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                Unlimited
              </div>
            )}
          </div>

          {/* Opportunities tile */}
          <div style={{ background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>Opportunities</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
              {limits.maxOpportunities >= 9999 ? 'Unlimited' : `${limits.maxOpportunities} / session`}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Per session limit</div>
          </div>
        </div>

        {/* ── 3. PORTFOLIO STATS ──────────────────────────────── */}
        <div style={{ marginTop: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
                My Collection
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
                Track your artworks and monitor their estimated value over time
              </p>
            </div>
            <button
              onClick={() => { setShowAddForm(v => !v); setAddError(''); }}
              style={{
                padding: '10px 20px', background: showAddForm ? 'var(--bg-subtle)' : 'var(--navy)',
                color: showAddForm ? 'var(--text-2)' : 'white',
                border: '1px solid var(--border)', borderRadius: '6px',
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {showAddForm ? 'Cancel' : '+ Add Artwork'}
            </button>
          </div>

          {/* Stats strip */}
          {!portfolioLoading && portfolioStats && portfolioStats.total_items > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
              background: 'var(--border)', border: '2px solid var(--border)',
              borderRadius: '10px', overflow: 'hidden', marginBottom: '32px',
            }}>
              <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Total Invested</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
                  {fmt(portfolioStats.total_invested)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Est. Value</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
                  {fmt(portfolioStats.estimated_total_value)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Total Return</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700,
                  color: portfolioStats.gain_pct >= 0 ? '#1A7A4A' : '#C0392B',
                }}>
                  {portfolioStats.gain_pct >= 0 ? '+' : ''}{portfolioStats.gain_pct}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Works</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
                  {portfolioStats.total_items}
                  {portfolioStats.items_with_valuation > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 400 }}> ({portfolioStats.items_with_valuation} valued)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add artwork form */}
          {showAddForm && (
            <form
              onSubmit={handleAddItem}
              style={{
                background: 'var(--bg-card)', border: '2px solid var(--border)',
                borderRadius: '10px', padding: '28px 32px', marginBottom: '32px',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
                Add an Artwork
              </h3>
              {addError && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '6px', fontSize: '12px', color: '#C0392B' }}>
                  {addError}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.title}
                    onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Composition No. 12"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Artist
                  </label>
                  <input
                    type="text"
                    value={addForm.artist_name}
                    onChange={e => setAddForm(f => ({ ...f, artist_name: e.target.value }))}
                    placeholder="e.g. Joan Miró"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Purchase Price (EUR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={addForm.purchase_price_eur}
                    onChange={e => setAddForm(f => ({ ...f, purchase_price_eur: e.target.value }))}
                    placeholder="e.g. 12000"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={addForm.purchase_date}
                    onChange={e => setAddForm(f => ({ ...f, purchase_date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Medium
                  </label>
                  <input
                    type="text"
                    value={addForm.medium}
                    onChange={e => setAddForm(f => ({ ...f, medium: e.target.value }))}
                    placeholder="e.g. Oil on canvas"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Notes
                  </label>
                  <input
                    type="text"
                    value={addForm.notes}
                    onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Provenance, condition, etc."
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    padding: '10px 24px', background: 'var(--navy)', color: 'white',
                    border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    cursor: addLoading ? 'not-allowed' : 'pointer', opacity: addLoading ? 0.6 : 1,
                  }}
                >
                  {addLoading ? 'Adding…' : 'Add to Collection'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddError(''); }}
                  style={{
                    padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)',
                    cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Portfolio items list */}
          {portfolioLoading && (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div className="skeleton" style={{ height: '80px', borderRadius: '8px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '80px', borderRadius: '8px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
            </div>
          )}

          {!portfolioLoading && portfolioItems.length === 0 && !showAddForm && (
            <div style={{
              border: '2px dashed var(--border)', borderRadius: '10px',
              padding: '64px 40px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: 'var(--border)', marginBottom: '16px' }}>◇</div>
              <div style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '6px' }}>No artworks in your collection yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
                Add works you've acquired to track their value over time
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: '12px 24px', background: 'var(--navy)', color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                + Add Your First Artwork
              </button>
            </div>
          )}

          {!portfolioLoading && portfolioItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {portfolioItems.map(item => (
                <div key={item.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* Item row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: '0', alignItems: 'center' }}>
                    {/* Thumbnail */}
                    <div style={{ width: '56px', height: '56px', background: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--border)' }}>◇</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '14px 16px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '3px' }}>
                        {item.artist_name && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
                            {item.artist_name}
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {fmt(item.purchase_price_eur)}
                        </span>
                        {item.purchase_date && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                            {new Date(item.purchase_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {item.medium && (
                          <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.medium}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', flexShrink: 0 }}>
                      {/* Gain badge */}
                      {item.gain_pct !== null && (
                        <div style={{
                          padding: '3px 8px', borderRadius: '4px',
                          background: item.gain_pct >= 0 ? 'rgba(26,122,74,0.08)' : 'rgba(192,57,43,0.08)',
                          border: `1px solid ${item.gain_pct >= 0 ? 'rgba(26,122,74,0.2)' : 'rgba(192,57,43,0.2)'}`,
                        }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: item.gain_pct >= 0 ? '#1A7A4A' : '#C0392B' }}>
                            {item.gain_pct >= 0 ? '+' : ''}{item.gain_pct}%
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => editingId === item.id ? setEditingId(null) : startEdit(item)}
                        style={{
                          padding: '6px 12px', background: 'transparent',
                          border: '1px solid var(--border)', borderRadius: '5px',
                          fontSize: '11px', fontWeight: 600, color: 'var(--text-2)',
                          cursor: 'pointer', letterSpacing: '0.03em',
                        }}
                      >
                        {editingId === item.id ? 'Close' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={deletingId === item.id}
                        style={{
                          padding: '6px 12px', background: 'transparent',
                          border: '1px solid rgba(192,57,43,0.3)', borderRadius: '5px',
                          fontSize: '11px', fontWeight: 600, color: '#C0392B',
                          cursor: deletingId === item.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === item.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === item.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editingId === item.id && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', background: 'var(--bg)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 20px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '5px' }}>Title</label>
                          <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '5px' }}>Artist</label>
                          <input type="text" value={editForm.artist_name} onChange={e => setEditForm(f => ({ ...f, artist_name: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '5px' }}>Purchase Price (EUR)</label>
                          <input type="number" min="0" step="any" value={editForm.purchase_price_eur} onChange={e => setEditForm(f => ({ ...f, purchase_price_eur: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '5px' }}>Est. Current Value (EUR)</label>
                          <input type="number" min="0" step="any" value={editForm.estimated_current_value_eur} onChange={e => setEditForm(f => ({ ...f, estimated_current_value_eur: e.target.value }))} placeholder="Optional" style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '5px' }}>Medium</label>
                          <input type="text" value={editForm.medium} onChange={e => setEditForm(f => ({ ...f, medium: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '5px' }}>Notes</label>
                          <input type="text" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={editLoading}
                          style={{
                            padding: '8px 20px', background: 'var(--navy)', color: 'white',
                            border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
                            letterSpacing: '0.05em', textTransform: 'uppercase',
                            cursor: editLoading ? 'not-allowed' : 'pointer', opacity: editLoading ? 0.6 : 1,
                          }}
                        >
                          {editLoading ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4. MARKET OPPORTUNITIES ────────────────────────── */}
        <div style={{ marginTop: '56px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
              Market Opportunities
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
              Top scoring lots right now
            </p>
          </div>

          {lotsLoading && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
            }}>
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {!lotsLoading && lotsError && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '16px' }}>{lotsError}</div>
              <button
                onClick={() => { setLotsError(''); setLotsLoading(true); window.location.reload(); }}
                className="btn btn-navy"
                style={{ fontSize: '11px', padding: '10px 22px' }}
              >
                Retry
              </button>
            </div>
          )}

          {!lotsLoading && !lotsError && lots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--border)', marginBottom: '16px' }}>◇</div>
              <div style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '6px' }}>No opportunities tracked yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>Browse the market to discover high-scoring lots</div>
              <Link to="/app/opportunities" className="btn btn-navy" style={{ textDecoration: 'none', fontSize: '11px' }}>
                Browse Opportunities
              </Link>
            </div>
          )}

          {!lotsLoading && !lotsError && lots.length > 0 && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '20px',
              }}>
                {lots.slice(0, 12).map(lot => (
                  <AlphaCard
                    key={lot.id}
                    lot={lot}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                  />
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '32px' }}>
                <Link
                  to="/app/opportunities"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
                    color: 'var(--navy)', textDecoration: 'none', letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  View all opportunities →
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Close portfolio tab */}
        </>}

        {/* ── 5. PLAN FEATURES PANEL ─────────────────────────── */}
        {false && <div style={{ marginTop: '56px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 24px' }}>
            Your Plan — {planLabel}
          </h2>

          <div style={{
            background: 'var(--bg-card)', border: '2px solid var(--border)',
            borderRadius: '10px', padding: '28px 32px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px',
          }}>
            <div>
              <FeatureRow
                label="Opportunities"
                value={limits.maxOpportunities >= 9999 ? 'Unlimited' : String(limits.maxOpportunities)}
                active={true}
              />
              <FeatureRow
                label="AI Analyses / month"
                value={usageLimit === 0 ? '—' : usageLimit >= 999 ? 'Unlimited' : String(usageLimit)}
                active={usageLimit > 0}
              />
              <FeatureRow
                label="Investment Analysis"
                value={limits.hasFullAnalysis ? '✓' : '—'}
                active={limits.hasFullAnalysis}
              />
              <FeatureRow
                label="AI Investment Advisor"
                value={limits.hasAIVerdict ? '✓' : '—'}
                active={limits.hasAIVerdict}
              />
            </div>
            <div>
              <FeatureRow
                label="Price Projections"
                value={limits.projectionYears.length > 0 ? limits.projectionYears.map(y => `${y}y`).join(', ') : '—'}
                active={limits.projectionYears.length > 0}
              />
              <FeatureRow
                label="Real-time Alerts"
                value={limits.hasAlerts ? '✓' : '—'}
                active={limits.hasAlerts}
              />
              <FeatureRow
                label="Portfolio Tracking"
                value={limits.hasPortfolio ? '✓' : '—'}
                active={limits.hasPortfolio}
              />
              <FeatureRow
                label="Full Artist Profiles"
                value={limits.hasFullArtistProfile ? '✓' : '—'}
                active={limits.hasFullArtistProfile}
              />
            </div>
          </div>

          {/* Upgrade CTA */}
          {isFreePlan && (
            <div style={{
              marginTop: '24px', background: 'var(--navy)', borderRadius: '10px',
              padding: '40px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: 'white', margin: '0 0 8px' }}>
                  Unlock the full platform
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0, maxWidth: '420px' }}>
                  Get unlimited opportunities, AI analyses, price projections, and real-time alerts. Built for serious collectors.
                </p>
              </div>
              <Link
                to="/app/pricing"
                style={{
                  padding: '14px 28px', background: 'var(--gold)', color: 'white',
                  borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
                  flexShrink: 0, marginLeft: '32px',
                  boxShadow: '0 4px 16px rgba(198,168,90,0.4)',
                }}
              >
                Upgrade Now
              </Link>
            </div>
          )}
        </div>

        }
        {/* ── 6. DANGER ZONE (moved to Abonnement tab) ────────── */}
        {false && <div style={{ marginTop: '56px' }}>
          <div style={{
            border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px',
            padding: '28px 32px', background: 'rgba(192,57,43,0.02)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#C0392B', margin: '0 0 8px' }}>
              Danger Zone
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 20px' }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                style={{
                  padding: '10px 20px', background: 'transparent',
                  border: '1px solid rgba(192,57,43,0.4)', borderRadius: '6px',
                  color: '#C0392B', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
                }}
              >
                Delete Account
              </button>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    style={{
                      padding: '10px 14px', border: '1px solid var(--border)',
                      borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-card)', color: 'var(--text)', outline: 'none', width: '160px',
                    }}
                  />
                  <button
                    disabled={deleteInput !== 'DELETE'}
                    style={{
                      padding: '10px 20px',
                      background: deleteInput === 'DELETE' ? '#C0392B' : 'var(--bg-subtle)',
                      border: 'none', borderRadius: '6px',
                      color: deleteInput === 'DELETE' ? 'white' : 'var(--text-3)',
                      fontSize: '12px', fontWeight: 600,
                      cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}
                    onClick={() => {
                      if (deleteInput === 'DELETE') {
                        logout();
                        navigate('/');
                      }
                    }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                    style={{
                      padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: '6px', color: 'var(--text-2)', fontSize: '12px',
                      cursor: 'pointer', letterSpacing: '0.04em',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>}

      </div>
    </div>
  );
}
