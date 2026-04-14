import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getUser, getPlanLimits, getToken, logout, PLAN_LIMITS } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
import { AlertsContent } from './Alerts';
import { getSubscription, cancelSubscription } from '../../lib/api';
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

interface WatchlistLot {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  auction_house: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  current_price: number | null;
  deal_score: number | null;
  auction_date: string | null;
  status: string | null;
}

interface WatchlistItem {
  watchlist_id: string;
  lot_id: string;
  note: string | null;
  added_at: string | null;
  lot: WatchlistLot;
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
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: active ? 'var(--electric)' : 'var(--text-3)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Portfolio() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFeedback, setCancelFeedback] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

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

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Watchlist state
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Favorite artists state
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [newArtistInput, setNewArtistInput] = useState('');
  const [artistActionLoading, setArtistActionLoading] = useState(false);

  async function loadWatchlist() {
    setWatchlistLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/portfolio/watchlist`, { headers: authHeaders() });
      if (res.ok) setWatchlistItems(await res.json());
    } catch { /* silent */ } finally { setWatchlistLoading(false); }
  }

  async function loadFavoriteArtists() {
    setArtistsLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/portfolio/favorite-artists`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setFavoriteArtists(d.artists || []); }
    } catch { /* silent */ } finally { setArtistsLoading(false); }
  }

  async function removeFromWatchlist(lotId: string) {
    await fetch(`${BACKEND}/api/portfolio/watchlist/${lotId}`, { method: 'DELETE', headers: authHeaders() });
    setWatchlistItems(items => items.filter(i => i.lot_id !== lotId));
  }

  async function addFavoriteArtist() {
    if (!newArtistInput.trim()) return;
    setArtistActionLoading(true);
    try {
      await fetch(`${BACKEND}/api/portfolio/favorite-artists`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ artist_name: newArtistInput.trim() }),
      });
      setFavoriteArtists(a => [...a, newArtistInput.trim()]);
      setNewArtistInput('');
    } catch { /* silent */ } finally { setArtistActionLoading(false); }
  }

  async function removeFavoriteArtist(name: string) {
    await fetch(`${BACKEND}/api/portfolio/favorite-artists/${encodeURIComponent(name)}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    setFavoriteArtists(a => a.filter(n => n !== name));
  }

  const generatePortfolioAnalysis = async () => {
    setAiLoading(true);
    try {
      const resp = await fetch(`${BACKEND}/api/portfolio-ai/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await resp.json();
      if (resp.status === 403) {
        navigate('/app/pricing');
        return;
      }
      setAiAnalysis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

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
    fetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&page_size=12`, {
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
        fetch(`${BACKEND}/api/portfolio/stats`, { headers: authHeaders() }),
        fetch(`${BACKEND}/api/portfolio/items`, { headers: authHeaders() }),
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
      const res = await fetch(`${BACKEND}/api/portfolio/items`, {
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
      const res = await fetch(`${BACKEND}/api/portfolio/items/${itemId}`, {
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
      await fetch(`${BACKEND}/api/portfolio/items/${itemId}`, {
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

  type PortfolioTab = 'collection' | 'watchlist' | 'artists' | 'alerts' | 'billing' | 'settings';
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>('collection');

  const PORTFOLIO_TABS: { id: PortfolioTab; label: string }[] = [
    { id: 'collection', label: 'My Collection' },
    { id: 'watchlist',  label: 'Watchlist'     },
    { id: 'artists',    label: 'Artists'       },
    { id: 'alerts',     label: 'Alerts'        },
    { id: 'billing',    label: 'Plan & Billing' },
    { id: 'settings',   label: 'Settings'      },
  ];

  // Settings state
  const [settingsForm, setSettingsForm] = useState({ fullName: user?.name || '', phone: '' });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    if (portfolioTab === 'watchlist') loadWatchlist();
    if (portfolioTab === 'artists') loadFavoriteArtists();
  }, [portfolioTab]);

  useEffect(() => {
    if (portfolioTab !== 'settings') return;
    setInvoicesLoading(true);
    const token = getToken();
    fetch(`${BACKEND}/api/billing/invoices`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { setInvoices(d.invoices || []); })
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  }, [portfolioTab]);

  async function openBillingPortal() {
    try {
      const token = getToken();
      const resp = await fetch(`${BACKEND}/api/billing/portal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) { navigate('/app/pricing'); return; }
      const data = await resp.json();
      if (data.url) window.open(data.url, '_blank');
      else navigate('/app/pricing');
    } catch {
      navigate('/app/pricing');
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const token = getToken();
      await fetch(`${BACKEND}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ full_name: settingsForm.fullName || null, phone: settingsForm.phone || null }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch { /* silent */ } finally {
      setSettingsSaving(false);
    }
  }

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
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
              Portfolio
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)' }}>Track your collection and manage your account</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.email && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
                {user.email}
              </span>
            )}
            <span style={{
              padding: '4px 12px', borderRadius: '4px',
              background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
              color: 'var(--electric)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {planLabel}
            </span>
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
                borderBottom: portfolioTab === id ? '2px solid var(--electric)' : '2px solid transparent',
                marginBottom: '-2px', cursor: 'pointer',
                fontSize: '13px', fontWeight: portfolioTab === id ? 600 : 400,
                color: portfolioTab === id ? 'var(--text)' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── ALERTS TAB ─────────────────────────────────────── */}
        {portfolioTab === 'alerts' && <AlertsContent />}

        {/* ── WATCHLIST TAB ──────────────────────────────────── */}
        {portfolioTab === 'watchlist' && (
          <div style={{ paddingTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Watchlist</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Lots you've saved to monitor</p>
              </div>
            </div>

            {watchlistLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '8px' }} />
                ))}
              </div>
            )}

            {!watchlistLoading && watchlistItems.length === 0 && (
              <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '64px 40px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: 'var(--border)', marginBottom: '16px' }}>◇</div>
                <div style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '6px' }}>No lots saved yet</div>
                <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
                  Save lots from the opportunities page to track them here
                </div>
                <Link to="/app/opportunities" style={{ padding: '12px 24px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' }}>
                  Browse Opportunities
                </Link>
              </div>
            )}

            {!watchlistLoading && watchlistItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {watchlistItems.map(item => {
                  const lot = item.lot;
                  const price = lot.current_price || lot.estimate_low;
                  const ds = lot.deal_score || 0;
                  const dsColor = ds >= 80 ? '#C0392B' : ds >= 65 ? 'var(--navy)' : 'var(--text-3)';
                  return (
                    <div key={item.watchlist_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', alignItems: 'center' }}>
                        <div style={{ width: '56px', height: '56px', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {lot.image_url ? (
                            <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--border)' }}>◇</span>
                          )}
                        </div>
                        <div style={{ padding: '14px 16px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '3px' }}>
                            {lot.artist_name && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
                                {lot.artist_name}
                              </span>
                            )}
                            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lot.title}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {price && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                                {fmt(price)}
                              </span>
                            )}
                            {lot.auction_house && (
                              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{lot.auction_house.split('—')[0].trim()}</span>
                            )}
                            {lot.auction_date && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                                {new Date(lot.auction_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px', flexShrink: 0 }}>
                          {ds > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: dsColor }}>{Math.round(ds)}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-3)' }}>/100</span>
                            </div>
                          )}
                          <button
                            onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => removeFromWatchlist(item.lot_id)}
                            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#C0392B', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ARTISTS TAB ────────────────────────────────────── */}
        {portfolioTab === 'artists' && (
          <div style={{ paddingTop: '8px', maxWidth: '720px' }}>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Artists</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Artists you follow — alerts will be triggered when new lots appear</p>
            </div>

            {/* Add artist */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
              <input
                type="text"
                value={newArtistInput}
                onChange={e => setNewArtistInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFavoriteArtist()}
                placeholder="Artist name (e.g. Joan Miró)"
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
              />
              <button
                onClick={addFavoriteArtist}
                disabled={artistActionLoading || !newArtistInput.trim()}
                style={{ padding: '10px 20px', background: newArtistInput.trim() ? 'var(--navy)' : 'var(--bg-subtle)', color: newArtistInput.trim() ? 'white' : 'var(--text-3)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: newArtistInput.trim() ? 'pointer' : 'not-allowed' }}
              >
                {artistActionLoading ? '…' : '+ Follow'}
              </button>
            </div>

            {artistsLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '8px' }} />)}
              </div>
            )}

            {!artistsLoading && favoriteArtists.length === 0 && (
              <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--border)', marginBottom: '12px' }}>◈</div>
                <div style={{ fontSize: '15px', color: 'var(--text-2)', marginBottom: '6px' }}>No artists followed yet</div>
                <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Add artists above to get notified when they appear at auction</div>
              </div>
            )}

            {!artistsLoading && favoriteArtists.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {favoriteArtists.map(name => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text-3)' }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Following · alerts active</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Link
                        to={`/app/opportunities?artist=${encodeURIComponent(name)}`}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }}
                      >
                        Browse lots
                      </Link>
                      <button
                        onClick={() => removeFavoriteArtist(name)}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#C0392B', cursor: 'pointer' }}
                      >
                        Unfollow
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BILLING TAB ────────────────────────────────────── */}
        {portfolioTab === 'billing' && (
          <div style={{ paddingTop: '8px' }}>
            {/* Current plan card — electric border */}
            <div style={{ border: '2px solid var(--electric-border)', borderRadius: '12px', padding: '32px', background: 'var(--electric-subtle)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--electric)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '6px' }}>Current Plan</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)' }}>{planLabel}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', animation: 'pulseDot 2s infinite' }} />
                  <span style={{ fontSize: '11px', color: 'var(--electric)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Active</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px', marginBottom: '24px' }}>
                <div>
                  <FeatureRow label="Opportunities" value={limits.maxOpportunities >= 9999 ? 'Unlimited' : String(limits.maxOpportunities)} active={true} />
                  <FeatureRow label="AI Analyses / month" value={usageLimit === 0 ? '—' : usageLimit >= 999 ? 'Unlimited' : String(usageLimit)} active={usageLimit > 0} />
                  <FeatureRow label="Investment Analysis" value={limits.hasFullAnalysis ? '✓' : '—'} active={limits.hasFullAnalysis} />
                  <FeatureRow label="AI Advisor" value={limits.hasAIVerdict ? '✓' : '—'} active={limits.hasAIVerdict} />
                </div>
                <div>
                  <FeatureRow label="Price Projections" value={limits.projectionYears.length > 0 ? limits.projectionYears.map((y: number) => `${y}y`).join(', ') : '—'} active={limits.projectionYears.length > 0} />
                  <FeatureRow label="Real-time Alerts" value={limits.hasAlerts ? '✓' : '—'} active={limits.hasAlerts} />
                  <FeatureRow label="Portfolio Tracking" value={limits.hasPortfolio ? '✓' : '—'} active={limits.hasPortfolio} />
                  <FeatureRow label="Full Artist Profiles" value={limits.hasFullArtistProfile ? '✓' : '—'} active={limits.hasFullArtistProfile} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {isFreePlan ? (
                  <Link to="/app/pricing" className="btn-electric" style={{ padding: '10px 24px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    Upgrade Plan
                  </Link>
                ) : (
                  <button
                    onClick={() => { setShowCancelModal(true); setCancelStep(1); setCancelReason(''); setCancelFeedback(''); }}
                    style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', letterSpacing: '0.04em' }}
                  >
                    Cancel subscription
                  </button>
                )}
              </div>
            </div>

            {/* Danger zone — discreet */}
            <div style={{ marginTop: '32px', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '24px 28px', background: 'var(--bg-subtle)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--text-2)', margin: '0 0 6px' }}>Danger Zone</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 16px' }}>Permanently delete your account and all associated data.</p>
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-3)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}>
                  Delete account
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
        {portfolioTab === 'collection' && <>

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

          {portfolioItems.length >= 2 && (
            <div style={{ marginTop: '32px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', background: 'var(--bg-subtle)', borderBottom: aiAnalysis ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>◎ AI Portfolio Analysis</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', padding: '2px 7px', borderRadius: '10px' }}>INVESTOR+</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    Diversification · Risk assessment · Rebalancing recommendations
                  </span>
                </div>
                <button
                  onClick={generatePortfolioAnalysis}
                  disabled={aiLoading}
                  style={{
                    padding: '8px 18px', borderRadius: '6px', border: 'none',
                    background: aiLoading ? 'var(--bg-hover)' : 'var(--navy)',
                    color: aiLoading ? 'var(--text-3)' : 'white',
                    fontSize: '11px', fontWeight: 700,
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}
                >
                  {aiLoading ? 'Analyzing...' : aiAnalysis ? '↺ Refresh' : '+ Analyze'}
                </button>
              </div>

              {/* Results */}
              {aiAnalysis && !aiAnalysis.insufficient_data && (
                <div style={{ padding: '20px' }}>
                  {/* Score grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                    {[
                      { label: 'PORTFOLIO SCORE', value: `${aiAnalysis.score}/100` },
                      { label: 'DIVERSIFICATION', value: `${aiAnalysis.diversification_score}/100` },
                      { label: 'LIQUIDITY', value: `${aiAnalysis.liquidity_score}/100` },
                      { label: 'GROWTH POTENTIAL', value: `${aiAnalysis.growth_potential}/100` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '12px 16px', background: 'white' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.8, marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: '6px', fontStyle: 'italic' }}>
                    {aiAnalysis.summary}
                  </p>

                  {/* Recommendations */}
                  {aiAnalysis.recommendations?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
                        Recommendations
                      </div>
                      {aiAnalysis.recommendations.map((rec: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < aiAnalysis.recommendations.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                          <span style={{
                            fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                            padding: '2px 8px', borderRadius: '3px', flexShrink: 0, marginTop: '2px',
                            background: rec.priority === 'HIGH' ? 'var(--red-subtle)' : rec.priority === 'MEDIUM' ? 'var(--gold-subtle)' : 'var(--bg-subtle)',
                            color: rec.priority === 'HIGH' ? 'var(--red)' : rec.priority === 'MEDIUM' ? 'var(--gold-dim)' : 'var(--text-3)',
                          }}>
                            {rec.priority}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{rec.action}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{rec.rationale}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '16px', fontSize: '10px', color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                    Nautilus Intelligence · {new Date(aiAnalysis.generated_at).toLocaleDateString('fr-FR')} · NOT FINANCIAL ADVICE
                  </div>
                </div>
              )}

              {aiAnalysis?.insufficient_data && (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
                  {aiAnalysis.message}
                </div>
              )}
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

        {/* ── SETTINGS TAB ───────────────────────────────────── */}
        {portfolioTab === 'settings' && (
          <div style={{ paddingTop: '8px', maxWidth: '640px' }}>

            {/* Profile section */}
            <form onSubmit={saveSettings}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
                Profile
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={settingsForm.fullName}
                    onChange={e => setSettingsForm(f => ({ ...f, fullName: e.target.value }))}
                    placeholder="Your full name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={settingsForm.phone}
                    onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+33 6 00 00 00 00"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  style={{
                    padding: '10px 24px', background: 'var(--navy)', color: 'white',
                    border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    cursor: settingsSaving ? 'not-allowed' : 'pointer', opacity: settingsSaving ? 0.6 : 1,
                  }}
                >
                  {settingsSaving ? 'Saving…' : 'Save Changes'}
                </button>
                {settingsSaved && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#1A7A4A' }}>
                    ✓ Saved
                  </span>
                )}
              </div>
            </form>

            <div style={{ height: '1px', background: 'var(--border)', margin: '36px 0' }} />

            {/* Language */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
                Language
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['en', 'fr'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => { i18n.changeLanguage(lang); localStorage.setItem('i18nextLng', lang); }}
                    style={{
                      padding: '8px 20px',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: currentLang === lang ? 'var(--electric)' : 'var(--border)',
                      borderRadius: '6px',
                      background: currentLang === lang ? 'var(--electric-subtle)' : 'transparent',
                      color: currentLang === lang ? 'var(--electric)' : 'var(--text-2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lang === 'en' ? 'English' : 'Français'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)', margin: '36px 0' }} />

            {/* Billing & Invoices */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '16px' }}>
                Billing & Invoices
              </div>

              {invoicesLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div className="pulse-dot" style={{ margin: '0 auto' }} />
                </div>
              ) : invoices.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
                  No invoices yet. They will appear here after your first payment.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {invoices.map((inv: any) => (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                          {new Date(inv.created * 1000).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {inv.description || 'Nautilus subscription'} · {((inv.amount_paid || 0) / 100).toFixed(2)} {(inv.currency || 'EUR').toUpperCase()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: inv.status === 'paid' ? 'var(--electric)' : 'var(--text-3)', background: inv.status === 'paid' ? 'var(--electric-subtle)' : 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '10px', border: `1px solid ${inv.status === 'paid' ? 'var(--electric-border)' : 'var(--border)'}` }}>
                          {(inv.status || '').toUpperCase()}
                        </span>
                        {inv.invoice_pdf && (
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--electric)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', border: '1px solid var(--electric-border)', borderRadius: '4px', background: 'var(--electric-subtle)' }}>
                            ↓ PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={openBillingPortal}
                style={{ width: '100%', marginTop: '16px', padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 600 }}
              >
                Manage subscription in Stripe portal →
              </button>
            </div>

          </div>
        )}

      </div>

    {/* ── CANCEL SUBSCRIPTION MODAL ──────────────────────── */}
    {showCancelModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', maxWidth: '480px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            {([1, 2] as const).map((step) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: cancelStep >= step ? 'var(--electric)' : 'var(--bg-subtle)', color: cancelStep >= step ? 'white' : 'var(--text-3)' }}>{step}</div>
                {step < 2 && <div style={{ width: '32px', height: '1px', background: cancelStep > step ? 'var(--electric)' : 'var(--border)' }} />}
              </div>
            ))}
            <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: '8px' }}>Step {cancelStep} of 2</span>
          </div>

          {cancelStep === 1 && (
            <>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Cancel subscription?</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>We're sorry to see you go. Could you tell us why you're cancelling?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
                {['Too expensive', 'Not using it enough', 'Missing features I need', 'Found a better alternative', 'Technical issues', 'Other'].map(reason => (
                  <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: `1px solid ${cancelReason === reason ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', background: cancelReason === reason ? 'var(--electric-subtle)' : 'white' }}>
                    <input type="radio" name="cancelReason" value={reason} checked={cancelReason === reason} onChange={() => setCancelReason(reason)} style={{ accentColor: 'var(--electric)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text)' }}>{reason}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setCancelStep(2)} disabled={!cancelReason} className="btn-electric" style={{ padding: '11px 24px', fontSize: '13px', opacity: cancelReason ? 1 : 0.4, cursor: cancelReason ? 'pointer' : 'not-allowed' }}>Next</button>
                <button onClick={() => setShowCancelModal(false)} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Keep subscription</button>
              </div>
            </>
          )}

          {cancelStep === 2 && (
            <>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Any additional feedback?</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.6 }}>Your feedback helps us improve. This is optional.</p>
              <textarea value={cancelFeedback} onChange={e => setCancelFeedback(e.target.value)} placeholder="Tell us more..." rows={4} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', color: 'var(--text)', background: 'var(--bg-subtle)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '24px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  disabled={cancelLoading}
                  onClick={async () => {
                    setCancelLoading(true);
                    try { await cancelSubscription(); } catch {}
                    setCancelLoading(false);
                    setShowCancelModal(false);
                    getSubscription().then(setSub).catch(() => {});
                  }}
                  style={{ padding: '11px 20px', background: 'var(--red)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: cancelLoading ? 'not-allowed' : 'pointer', opacity: cancelLoading ? 0.7 : 1 }}
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm cancellation'}
                </button>
                <button onClick={() => setCancelStep(1)} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Back</button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
