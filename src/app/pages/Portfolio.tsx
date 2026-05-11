import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getUser, getToken, logout, PLAN_LIMITS } from '../../lib/auth';
import { getSubscription, cancelSubscription } from '../../lib/api';
import { getUsageStatus, PLAN_LIMITS as USAGE_LIMITS } from '../../lib/analysisUsage';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  trial_end?: number;
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
  artist_name: string;
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
  purchase_source: string | null;
  purchase_auction_house: string | null;
  purchase_location: string | null;
  country_of_origin: string | null;
  certificate_of_authenticity: boolean | null;
  authenticated_by: string | null;
  storage_location: string | null;
  insured_value_eur: number | null;
  insurance_provider: string | null;
  timing_reasoning: string | null;
  recommended_sale_timing: string | null;
  year_created: string | null;
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

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
      <div style={{ position: 'relative', paddingTop: '75%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {lot.imageUrl ? (
          <img src={lot.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', transition: 'transform 0.5s ease' }} loading="lazy" decoding="async" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--border)' }}>◇</span>
          </div>
        )}
        <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 10px', background: tierBg, border: `1px solid ${tierColor}40`, borderRadius: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: tierColor, letterSpacing: '0.1em' }}>{tier}</span>
        </div>
        <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 8px', background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(4px)', borderRadius: '4px', border: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)' }}>{Math.round(ds)}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-3)' }}>/100</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(250,250,248,0.9), transparent)' }} />
      </div>
      <div style={{ padding: '14px 16px' }}>
        {lot.artistName !== 'Unknown Artist' && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lot.artistName}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{lot.price}</div>
            {lot.estimateLow > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>est. {lot.estimateLowFmt}</div>}
          </div>
          {lot.upsidePercent > 5 && (
            <div style={{ padding: '3px 8px', background: 'rgba(26,42,68,0.08)', border: '1px solid rgba(26,42,68,0.15)', borderRadius: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)' }}>+{lot.upsidePercent}% upside</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{lot.platform}</span>
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

function FeatureRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: active ? 'var(--electric)' : 'var(--text-3)' }}>{value}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Portfolio() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const user = getUser();
  const plan = user?.email === 'camillefroment907@gmail.com' ? 'pro' : (user?.plan ?? 'free');
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const usageLimit = USAGE_LIMITS[plan] ?? 0;
  const usageStatus = getUsageStatus(plan);

  // ── Tab state ──────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'collection';
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  // ── Subscription ───────────────────────────────────────────
  const [sub, setSub] = useState<SubData | null>(null);

  // ── Correlation matrix (Risk tab) ─────────────────────────
  const [corrMatrix, setCorrMatrix] = useState<any>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  // ── Market lots ────────────────────────────────────────────
  const [lots, setLots] = useState<MappedLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotsError, setLotsError] = useState('');
  const [opportunitiesSort, setOpportunitiesSort] = useState('deal_score');

  // ── Portfolio ──────────────────────────────────────────────
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  // ── Add form ───────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ title: '', artist_name: '', purchase_price_eur: '', purchase_date: '', medium: '', notes: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [newArtwork, setNewArtwork] = useState<Record<string, any>>({});

  // ── Edit form ──────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', artist_name: '', purchase_price_eur: '', estimated_current_value_eur: '', medium: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── AI Analysis ────────────────────────────────────────────
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [collectorBadge, setCollectorBadge] = useState<{
    label: string; rank: number; color: string; topPct: string;
  } | null>(null);

  // ── Watchlist ──────────────────────────────────────────────
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // ── Favorite artists ───────────────────────────────────────
  const [favoriteArtists, setFavoriteArtists] = useState<any[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [newArtistInput, setNewArtistInput] = useState('');
  const [artistActionLoading, setArtistActionLoading] = useState(false);

  // ── Settings ───────────────────────────────────────────────
  const [settingsForm, setSettingsForm] = useState({
    fullName: user?.name || '', phone: '',
    country: '', address: '',
    collectorType: '', horizon: '',
    annualBudget: '', expectedReturn: '',
    preferredStyles: '', preferredRegions: '',
    goals: '', currency: 'EUR',
    language: localStorage.getItem('i18nextLng') || (navigator.language?.startsWith('fr') ? 'fr' : 'en'),
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Invoices ───────────────────────────────────────────────
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // ── Cancel modal ───────────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFeedback, setCancelFeedback] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Delete account ─────────────────────────────────────────
  const [deleteModalState, setDeleteModalState] = useState<null | 'loading' | 'confirm' | 'success'>(null);
  const [deleteInfo, setDeleteInfo] = useState<{ billing_interval: string; subscription_end_date: string | null } | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // ── Notification prefs ─────────────────────────────────────
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});

  // ── Add artist modal ───────────────────────────────────────
  const [showAddArtist, setShowAddArtist] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');

  // ── Computed ───────────────────────────────────────────────
  const subscription = sub;
  const userPlan = plan;

  const PLAN_LABELS: Record<string, string> = {
    free: 'Free', starter: 'Collector', investor: 'Investor',
    pro: 'Pro', elite: 'Elite', institutional: 'Institutional',
  };
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const hasAccess = ["investor", "pro", "elite", "institutional"].includes(plan);
  const isFreePlan = !hasAccess || plan === 'starter';
  const billingInterval = sub?.billing_interval || 'monthly';
  const totalInvested = portfolioStats?.total_invested ?? 0;
  const totalValue = portfolioStats?.estimated_total_value ?? 0;
  const returnPct = portfolioStats?.gain_pct ?? 0;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  };

  // ── Tabs ───────────────────────────────────────────────────
  const TABS = [
    { key: 'collection', label: t('portfolio.collection') },
    { key: 'risk', label: t('portfolio.riskAnalysis'), soon: true },
    { key: 'watchlist', label: watchlist.length > 0 ? `${t('portfolio.watchlist')} (${watchlist.length})` : t('portfolio.watchlist') },
    { key: 'artists', label: favoriteArtists.length > 0 ? `${t('portfolio.artists')} (${favoriteArtists.length})` : t('portfolio.artists') },
    { key: 'alerts', label: t('portfolio.alerts') },
    { key: 'settings', label: t('portfolio.settings') },
    { key: 'subscription', label: t('portfolio.subscription') },
  ];

  // ── Auth helper ────────────────────────────────────────────
  function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  // ── Load functions ─────────────────────────────────────────

  async function loadPortfolio() {
    setPortfolioLoading(true);
    try {
      const [statsRes, itemsRes] = await Promise.all([
        fetch(`${BACKEND}/api/portfolio/stats`, { headers: authHeaders() }),
        fetch(`${BACKEND}/api/collection/items`, { headers: authHeaders() }),
      ]);
      if (statsRes.ok) setPortfolioStats(await statsRes.json());
      if (itemsRes.ok) {
        const items = await itemsRes.json();
        setPortfolioItems(items);
        const totalVal = items.reduce((sum: number, item: any) =>
          sum + (item.current_estimated_value_eur || item.purchase_price_eur || 0), 0);
        const badge =
          totalVal >= 1_000_000 ? { label: 'Mécène', rank: 5, color: '#C6A85A', topPct: 'Top 1%' } :
          totalVal >= 200_000   ? { label: 'Grand Collectionneur', rank: 4, color: '#C6A85A', topPct: 'Top 8%' } :
          totalVal >= 50_000    ? { label: 'Amateur éclairé', rank: 3, color: '#1A2A44', topPct: 'Top 22%' } :
          totalVal >= 5_000     ? { label: 'Collectionneur', rank: 2, color: '#6B7280', topPct: 'Top 45%' } :
                                  { label: 'Curieux', rank: 1, color: '#9CA3AF', topPct: '' };
        setCollectorBadge(badge);
      }
    } catch { /* silent */ } finally {
      setPortfolioLoading(false);
    }
  }

  async function loadWatchlist() {
    setWatchlistLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/portfolio/watchlist`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setWatchlist(Array.isArray(d) ? d : (d.items || []));
      }
    } catch { /* silent */ } finally { setWatchlistLoading(false); }
  }

  async function loadFavoriteArtists() {
    setArtistsLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/portfolio/favorite-artists`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setFavoriteArtists(d.artists || []); }
    } catch { /* silent */ } finally { setArtistsLoading(false); }
  }

  async function loadInvoices() {
    setInvoicesLoading(true);
    const token = getToken();
    fetch(`${BACKEND}/api/billing/invoices`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setInvoices(d.invoices || []))
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  }

  // ── On mount ───────────────────────────────────────────────
  useEffect(() => {
    loadPortfolio();
    getSubscription().then(setSub).catch(() => setSub({ plan, status: 'active' }));

    // Lots
    const token = getToken();
    setLotsLoading(true);
    fetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&page_size=12`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setLots((Array.isArray(data) ? data : (data.items || [])).map(mapLot)); setLotsLoading(false); })
      .catch(err => { setLotsError(err.message || 'Failed to load'); setLotsLoading(false); });

    // Preload watchlist, artists, invoices
    loadWatchlist();
    loadFavoriteArtists();
    loadInvoices();

    // Prefill settings form from /auth/me
    if (token) {
      fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          setSettingsForm(f => ({
            ...f,
            fullName: data.full_name || f.fullName,
            phone: data.phone || f.phone,
            country: data.country || f.country,
            address: data.address || f.address,
          }));
        })
        .catch(() => {});
    }
  }, []);

  // ── Tab switch effects ─────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'watchlist') loadWatchlist();
    if (activeTab === 'artists') loadFavoriteArtists();
    if (activeTab === 'alerts') loadAlertPrefs();
    if (activeTab === 'subscription' || activeTab === 'settings') loadInvoices();
    if (activeTab === 'risk' && !corrMatrix && portfolioItems.length >= 2) {
      const artistNames = [...new Set(portfolioItems.map(i => i.artist_name).filter(Boolean))] as string[];
      if (artistNames.length < 2) return;
      setCorrLoading(true);
      const token = getToken();
      fetch(`${BACKEND}/api/artist-profiles/correlation-matrix?artists=${encodeURIComponent(artistNames.join(','))}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.matrix?.length) setCorrMatrix(d); })
        .catch(() => {})
        .finally(() => setCorrLoading(false));
    }
  }, [activeTab, portfolioItems]);

  // ── Portfolio actions ──────────────────────────────────────

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.title || !addForm.purchase_price_eur) return;
    setAddLoading(true);
    setAddError('');
    try {
      const res = await fetch(`${BACKEND}/api/collection/items`, {
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
      setShowAddModal(false);
      await loadPortfolio();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add artwork');
    } finally {
      setAddLoading(false);
    }
  }

  const handleAddArtwork = async () => {
    if (!newArtwork.artist_name || !newArtwork.title || !newArtwork.purchase_price) return;
    try {
      const resp = await fetch(`${BACKEND}/api/collection/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          artist_name: newArtwork.artist_name,
          title: newArtwork.title,
          year_created: newArtwork.year_created || null,
          medium: newArtwork.medium || null,
          purchase_price_eur: parseFloat(newArtwork.purchase_price),
          current_estimated_value_eur: newArtwork.current_value ? parseFloat(newArtwork.current_value) : parseFloat(newArtwork.purchase_price),
          purchase_date: newArtwork.purchase_date || null,
          purchase_source: newArtwork.purchase_source || null,
          purchase_auction_house: newArtwork.purchase_auction_house || null,
          purchase_location: newArtwork.purchase_location || null,
          country_of_origin: newArtwork.country_of_origin || null,
          dimensions: newArtwork.dimensions || null,
          condition: newArtwork.condition || null,
          certificate_of_authenticity: newArtwork.certificate_of_authenticity === 'true',
          authenticated_by: newArtwork.authenticated_by || null,
          authentication_date: newArtwork.authentication_date || null,
          catalogue_raisonne_reference: newArtwork.catalogue_raisonne_reference || null,
          storage_location: newArtwork.storage_location || null,
          insured_value_eur: newArtwork.insured_value_eur ? parseFloat(newArtwork.insured_value_eur) : null,
          insurance_provider: newArtwork.insurance_provider || null,
          notes: newArtwork.notes || null,
        }),
      });
      if (resp.ok) {
        setNewArtwork({ artist_name: '', title: '', year_created: '', medium: '', purchase_price: '', current_value: '', purchase_date: '', purchase_source: '', purchase_auction_house: '', purchase_location: '', country_of_origin: '', dimensions: '', condition: '', certificate_of_authenticity: 'false', authenticated_by: '', authentication_date: '', catalogue_raisonne_reference: '', storage_location: '', insured_value_eur: '', insurance_provider: '', notes: '' });
        setShowAddModal(false);
        await loadPortfolio();
      }
    } catch {}
  };

  function openEditModal(item: PortfolioItem) {
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
      const res = await fetch(`${BACKEND}/api/collection/items/${itemId}`, {
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
    } catch { /* keep edit open */ } finally {
      setEditLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    setDeletingId(itemId);
    try {
      await fetch(`${BACKEND}/api/collection/items/${itemId}`, { method: 'DELETE', headers: authHeaders() });
      await loadPortfolio();
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  }

  const handleImageUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await fetch(`${BACKEND}/api/collection/items/${itemId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ image_url: base64 }),
        });
        setPortfolioItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, image_url: base64 } : item
        ));
      } catch { /* silent */ }
    };
    reader.readAsDataURL(file);
  };

  // ── Watchlist actions ──────────────────────────────────────

  const removeFromWatchlist = async (id: string) => {
    await fetch(`${BACKEND}/api/portfolio/watchlist/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` },
    });
    setWatchlist(prev => prev.filter((w: any) => w.id !== id));
  };

  // ── Artist actions ─────────────────────────────────────────

  const addFavoriteArtist = async () => {
    if (!newArtistName.trim()) return;
    try {
      await fetch(`${BACKEND}/api/portfolio/favorite-artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ artist_name: newArtistName.trim() }),
      });
      setNewArtistName('');
      setShowAddArtist(false);
      const r = await fetch(`${BACKEND}/api/portfolio/favorite-artists`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const d = await r.json();
      setFavoriteArtists(d.artists || []);
    } catch { /* silent */ }
  };

  const removeFavoriteArtist = async (id: string) => {
    await fetch(`${BACKEND}/api/portfolio/favorite-artists/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` },
    });
    setFavoriteArtists(prev => prev.filter((a: any) => a.id !== id));
  };

  const toggleArtistAlert = async (artistId: string, key: string, value: boolean) => {
    setFavoriteArtists(prev => prev.map((a: any) => a.id === artistId ? { ...a, [key]: value } : a));
    await fetch(`${BACKEND}/api/portfolio/favorite-artists/${artistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  };

  const ALERT_PREF_MAP: Record<string, string> = {
    notify_exceptional_deals: 'exceptional_opportunity',
    notify_price_alert: 'lot_below_market',
    notify_new_auction: 'new_auction_house',
    notify_new_lot_by_artist: 'new_lot_followed_artist',
    notify_artist_momentum: 'artist_momentum_change',
    notify_auction_reminder: 'auction_closing_24h',
    notify_portfolio_value: 'portfolio_value_change',
    notify_sell_opportunity: 'optimal_sell_window',
    notify_weekly_brief: 'weekly_brief',
    notify_monthly_report: 'monthly_report',
    notify_email: 'email_notifications',
  };

  const loadAlertPrefs = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND}/api/alerts/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      const mapped: Record<string, boolean> = {};
      for (const [frontendKey, backendKey] of Object.entries(ALERT_PREF_MAP)) {
        mapped[frontendKey] = data[backendKey] !== false;
      }
      setNotificationPrefs(prev => ({ ...prev, ...mapped }));
    } catch { /* silent */ }
  };

  const toggleNotification = (key: string) => {
    setNotificationPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveNotificationPrefs = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const payload: Record<string, boolean> = {};
      for (const [frontendKey, backendKey] of Object.entries(ALERT_PREF_MAP)) {
        payload[backendKey] = notificationPrefs[frontendKey] !== false;
      }
      await fetch(`${BACKEND}/api/alerts/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch { /* silent */ }
  };

  // ── AI analysis ────────────────────────────────────────────

  const generatePortfolioAnalysis = async () => {
    setAiLoading(true);
    try {
      const resp = await fetch(`${BACKEND}/api/portfolio-ai/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (resp.status === 403) { navigate('/app/pricing'); return; }
      const data = await resp.json();
      setAiAnalysis(data);
    } catch (e) { console.error(e); } finally { setAiLoading(false); }
  };

  // ── Billing ────────────────────────────────────────────────

  const openBillingPortal = async () => {
    try {
      const resp = await fetch(`${BACKEND}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!resp.ok) { navigate('/app/pricing'); return; }
      const data = await resp.json();
      if (data.url) window.open(data.url, '_blank');
      else navigate('/app/pricing');
    } catch { navigate('/app/pricing'); }
  };

  const handleCancelSubscription = async () => {
    try {
      await fetch(`${BACKEND}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setShowCancelModal(false);
      window.location.reload();
    } catch { /* silent */ }
  };

  const openDeleteModal = async () => {
    setDeleteModalState('loading');
    setDeleteError('');
    try {
      const subR = await fetch(`${BACKEND}/api/billing/subscription`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const subData = await subR.json();
      setDeleteInfo({
        billing_interval: subData.billing_interval || 'free',
        subscription_end_date: subData.current_period_end || null,
      });
    } catch {
      setDeleteInfo({ billing_interval: 'free', subscription_end_date: null });
    }
    setDeleteModalState('confirm');
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    try {
      const r = await fetch(`${BACKEND}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error('Request failed');
      setDeleteModalState('success');
      setTimeout(() => {
        localStorage.clear();
        navigate('/');
      }, 3000);
    } catch {
      setDeleteError('An error occurred. Please try again or contact privacy@get-nautilus.com');
    }
  };

  // ── Settings ───────────────────────────────────────────────

  const saveSettings = async () => {
    const token = getToken();
    if (!token) return;
    setSettingsSaving(true);
    try {
      const resp = await fetch(`${BACKEND}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: settingsForm.fullName,
          phone: settingsForm.phone,
          country: settingsForm.country,
          address: settingsForm.address,
          collector_type: settingsForm.collectorType,
          investment_horizon: settingsForm.horizon,
          annual_budget: settingsForm.annualBudget ? parseFloat(settingsForm.annualBudget) : null,
          expected_return: settingsForm.expectedReturn ? parseFloat(settingsForm.expectedReturn) : null,
          preferred_styles: settingsForm.preferredStyles,
          preferred_regions: settingsForm.preferredRegions,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      localStorage.setItem('i18nextLng', settingsForm.language);
      i18n.changeLanguage(settingsForm.language);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch { /* silent */ }
    finally { setSettingsSaving(false); }
  };

  function handleSignOut() {
    logout();
    navigate('/');
  }

  // ── Sorted lots for market section ─────────────────────────
  const sortedLots = [...lots].sort((a, b) => {
    if (opportunitiesSort === 'price_asc') return (a.estimateLow || 0) - (b.estimateLow || 0);
    if (opportunitiesSort === 'price_desc') return (b.estimateLow || 0) - (a.estimateLow || 0);
    if (opportunitiesSort === 'date_asc') return new Date(a.auctionDate || '9999').getTime() - new Date(b.auctionDate || '9999').getTime();
    return b.dealScore - a.dealScore; // default: deal_score
  });
  const displayedLots = !hasAccess ? sortedLots.slice(0, 6) : sortedLots.slice(0, 12);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="page" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

        {/* ── PAGE HEADER ───────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 0 28px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Portfolio</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-3)' }}>Track your collection and manage your account</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.email && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>{user.email}</span>
            )}
            <span style={{ padding: '4px 12px', borderRadius: '4px', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--electric)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {planLabel}
            </span>
            <button onClick={handleSignOut} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Sign out
            </button>
          </div>
        </div>

        {/* ── TAB BAR ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '32px' }}>
          {TABS.map(({ key, label, soon }: any) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '12px 20px', background: 'transparent', border: 'none',
                borderBottom: activeTab === key ? '2px solid var(--navy)' : '2px solid transparent',
                marginBottom: '-2px', cursor: 'pointer',
                fontSize: '13px', fontWeight: activeTab === key ? 600 : 400,
                color: activeTab === key ? 'var(--navy)' : 'var(--text-3)',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
                opacity: soon && activeTab !== key ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              {label}
              {soon && <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', background: 'rgba(198,168,90,0.12)', padding: '1px 5px', borderRadius: '3px', letterSpacing: '0.08em' }}>SOON</span>}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            COLLECTION TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'collection' && (
          <div className="animate-fade-in">
            {/* Stats row */}
            <div className="portfolio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: t('portfolio.totalInvestedLabel'), value: fmt(totalInvested) },
                { label: t('portfolio.estValueLabel'), value: fmt(totalValue) },
                { label: t('portfolio.totalReturnLabel'), value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`, highlight: returnPct > 0 },
                { label: t('portfolio.worksTracked'), value: String(portfolioItems.length) },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: highlight ? '#1A7A4A' : 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>

            {collectorBadge && (
              <div style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                background: '#0A1628', borderRadius: 8, padding: '10px 18px',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'rgba(198,168,90,0.7)', marginBottom: 4 }}>
                  {currentLang === 'fr' ? 'STATUT COLLECTIONNEUR' : 'COLLECTOR STATUS'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'white', marginBottom: 2 }}>
                  ✦ {collectorBadge.label}
                </div>
                {collectorBadge.topPct && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                    {collectorBadge.topPct} {currentLang === 'fr' ? 'des membres' : 'of members'}
                  </div>
                )}
              </div>
            )}

            {/* Collection header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text)', margin: 0 }}>{t('portfolio.myCollectionTitle')}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {portfolioItems.length > 0 && (
                  <a
                    href={`${BACKEND}/api/portfolio/export?format=csv`}
                    download="nautilus_portfolio.csv"
                    style={{ fontSize: '11px', color: 'var(--text-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('portfolio.exportCsv')}
                  </a>
                )}
                <button
                  onClick={() => { setNewArtwork({ artist_name: '', title: '', year_created: '', medium: '', purchase_price: '', current_value: '', purchase_date: '', purchase_source: '', purchase_auction_house: '', purchase_location: '', country_of_origin: '', dimensions: '', condition: '', certificate_of_authenticity: 'false', authenticated_by: '', authentication_date: '', catalogue_raisonne_reference: '', storage_location: '', insured_value_eur: '', insurance_provider: '', notes: '' }); setShowAddModal(true); }}
                  style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  {t('portfolio.addArtwork')}
                </button>
              </div>
            </div>

            {showAddModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
                onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
              >
                <div style={{ background: 'white', borderRadius: 12, width: '520px', maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
                  <div style={{ background: '#0A1628', padding: '22px 26px', borderRadius: '12px 12px 0 0' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(198,168,90,0.7)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Nautilus · Collection
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: 'white', marginBottom: 4 }}>
                      {currentLang === 'fr' ? 'Ajouter une œuvre' : 'Add artwork'}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {currentLang === 'fr'
                        ? 'Suivez la valeur et les performances de votre collection'
                        : 'Track value & performance of your collection'}
                    </div>
                  </div>
                  <div style={{ padding: '20px 26px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                    {/* ── SECTION 1 — Identification ── */}
                    <div style={{ gridColumn: '1 / -1', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>Identification</div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Artiste *</label>
                      <input className="input" placeholder="Jean-Michel Basquiat" value={newArtwork.artist_name || ''} onChange={e => setNewArtwork(f => ({ ...f, artist_name: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Titre *</label>
                      <input className="input" placeholder="Untitled, 1982" value={newArtwork.title || ''} onChange={e => setNewArtwork(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Année de création</label>
                      <input className="input" placeholder="1982" value={newArtwork.year_created || ''} onChange={e => setNewArtwork(f => ({ ...f, year_created: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Médium</label>
                      <select className="input" value={newArtwork.medium || ''} onChange={e => setNewArtwork(f => ({ ...f, medium: e.target.value }))}>
                        <option value="">—</option>
                        <option value="Peinture">Peinture</option>
                        <option value="Sculpture">Sculpture</option>
                        <option value="Photographie">Photographie</option>
                        <option value="Dessin">Dessin</option>
                        <option value="Estampe">Estampe</option>
                        <option value="Textile">Textile</option>
                        <option value="Céramique">Céramique</option>
                        <option value="Installation">Installation</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>

                    {/* ── SECTION 2 — Acquisition ── */}
                    <div style={{ gridColumn: '1 / -1', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>Acquisition</div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Prix d'achat (€) *</label>
                      <input className="input" type="number" placeholder="18000" value={newArtwork.purchase_price || ''} onChange={e => setNewArtwork(f => ({ ...f, purchase_price: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date d'achat</label>
                      <input className="input" type="date" value={newArtwork.purchase_date || ''} onChange={e => setNewArtwork(f => ({ ...f, purchase_date: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Source</label>
                      <select className="input" value={newArtwork.purchase_source || ''} onChange={e => setNewArtwork(f => ({ ...f, purchase_source: e.target.value }))}>
                        <option value="">—</option>
                        <option value="auction">Vente aux enchères</option>
                        <option value="gallery">Galerie</option>
                        <option value="private">Particulier</option>
                        <option value="art_fair">Foire d'art</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Maison de vente</label>
                      <input className="input" placeholder="Christie's Paris" value={newArtwork.purchase_auction_house || ''} onChange={e => setNewArtwork(f => ({ ...f, purchase_auction_house: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Lieu d'achat</label>
                      <input className="input" placeholder="Paris, France" value={newArtwork.purchase_location || ''} onChange={e => setNewArtwork(f => ({ ...f, purchase_location: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pays d'origine</label>
                      <input className="input" placeholder="France" value={newArtwork.country_of_origin || ''} onChange={e => setNewArtwork(f => ({ ...f, country_of_origin: e.target.value }))} />
                    </div>

                    {/* ── SECTION 3 — Description physique ── */}
                    <div style={{ gridColumn: '1 / -1', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>Description physique</div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dimensions</label>
                      <input className="input" placeholder="120 × 90 cm" value={newArtwork.dimensions || ''} onChange={e => setNewArtwork(f => ({ ...f, dimensions: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>État</label>
                      <select className="input" value={newArtwork.condition || ''} onChange={e => setNewArtwork(f => ({ ...f, condition: e.target.value }))}>
                        <option value="">—</option>
                        <option value="excellent">Excellent</option>
                        <option value="good">Bon</option>
                        <option value="fair">Correct</option>
                        <option value="restore">À restaurer</option>
                      </select>
                    </div>

                    {/* ── SECTION 4 — Authentification ── */}
                    <div style={{ gridColumn: '1 / -1', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>Authentification</div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" id="coa" checked={newArtwork.certificate_of_authenticity === 'true'} onChange={e => setNewArtwork(f => ({ ...f, certificate_of_authenticity: e.target.checked ? 'true' : 'false' }))} />
                      <label htmlFor="coa" style={{ fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>Certificat d'authenticité</label>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Expertisé par</label>
                      <input className="input" placeholder="Expert ou institution" value={newArtwork.authenticated_by || ''} onChange={e => setNewArtwork(f => ({ ...f, authenticated_by: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date d'expertise</label>
                      <input className="input" type="date" value={newArtwork.authentication_date || ''} onChange={e => setNewArtwork(f => ({ ...f, authentication_date: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Référence catalogue raisonné</label>
                      <input className="input" placeholder="Cat. raisonné n°..." value={newArtwork.catalogue_raisonne_reference || ''} onChange={e => setNewArtwork(f => ({ ...f, catalogue_raisonne_reference: e.target.value }))} />
                    </div>

                    {/* ── SECTION 5 — Conservation ── */}
                    <div style={{ gridColumn: '1 / -1', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>Conservation</div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Lieu de stockage</label>
                      <select className="input" value={newArtwork.storage_location || ''} onChange={e => setNewArtwork(f => ({ ...f, storage_location: e.target.value }))}>
                        <option value="">—</option>
                        <option value="home">Domicile</option>
                        <option value="vault">Coffre-fort</option>
                        <option value="gallery">Galerie</option>
                        <option value="loan">Prêt</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Valeur assurée (€)</label>
                      <input className="input" type="number" placeholder="Valeur assurée (€)" value={newArtwork.insured_value_eur || ''} onChange={e => setNewArtwork(f => ({ ...f, insured_value_eur: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Assureur</label>
                      <input className="input" placeholder="AXA Art" value={newArtwork.insurance_provider || ''} onChange={e => setNewArtwork(f => ({ ...f, insurance_provider: e.target.value }))} />
                    </div>

                    {/* ── SECTION 6 — Notes ── */}
                    <div style={{ gridColumn: '1 / -1', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, marginTop: 16, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>Notes</div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <textarea className="input" rows={3} placeholder="Provenance, expositions, historique..." value={newArtwork.notes || ''} onChange={e => setNewArtwork(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                    </div>

                  </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '16px 26px', borderTop: '0.5px solid var(--border)' }}>
                    <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', color: 'var(--text-2)', border: '0.5px solid var(--border)', borderRadius: 5, padding: '9px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                      {currentLang === 'fr' ? 'Annuler' : 'Cancel'}
                    </button>
                    <button onClick={handleAddArtwork} disabled={!newArtwork.artist_name || !newArtwork.title || !newArtwork.purchase_price} style={{ background: '#2563EB', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.07em', cursor: 'pointer', opacity: (!newArtwork.artist_name || !newArtwork.title || !newArtwork.purchase_price) ? 0.4 : 1 }}>
                      {currentLang === 'fr' ? 'Ajouter à ma collection →' : 'Add to collection →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {portfolioLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* Empty state */}
            {!portfolioLoading && portfolioItems.length === 0 && !showAddModal && (
              <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '2px dashed var(--border)', marginBottom: '32px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--navy)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: '20px' }}>+</span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text)', marginBottom: '8px' }}>Start tracking your collection</div>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '20px', maxWidth: '360px', margin: '0 auto 20px' }}>Add your artworks to monitor their value, track performance, and get AI-powered insights.</p>
                <button onClick={() => setShowAddModal(true)} style={{ padding: '10px 28px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Add my first artwork →
                </button>
              </div>
            )}

            {/* Collection card grid */}
            {!portfolioLoading && portfolioItems.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {portfolioItems.map(item => {
                  const currentVal = item.estimated_current_value_eur || item.purchase_price_eur;
                  const gainPct = item.gain_pct ?? null;
                  return (
                    <div key={item.id} style={{ borderRadius: 12, border: '0.5px solid var(--border)', overflow: 'hidden' }}>

                      {/* Image zone */}
                      <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#F0EBE0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(0,0,0,0.2)' }}>Photo à ajouter</span>
                          </div>
                        )}
                        {item.recommended_sale_timing && (
                          <div style={{ position: 'absolute', top: 8, left: 8, background: '#C0392B', color: 'white', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 3, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                            🔥 VENDRE MAINTENANT
                          </div>
                        )}
                        {item.certificate_of_authenticity && (
                          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(22,163,74,0.9)', color: 'white', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>
                            ✓ Authentifié
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div style={{ padding: 16 }}>

                        {/* Artist / title + value row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                            {item.artist_name && (
                              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 2 }}>
                                {item.artist_name}
                              </div>
                            )}
                            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#1A7A4A' }}>
                              {fmt(item.estimated_current_value_eur || item.purchase_price_eur)}
                            </div>
                            {gainPct != null && (
                              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: gainPct >= 0 ? '#1A7A4A' : '#C0392B' }}>
                                {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tags row */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                          {item.medium && (
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 3, padding: '2px 6px', color: 'var(--text-3)' }}>
                              {item.medium}
                            </span>
                          )}
                          {item.dimensions && (
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 3, padding: '2px 6px', color: 'var(--text-3)' }}>
                              {item.dimensions}
                            </span>
                          )}
                          {item.purchase_date && (
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 3, padding: '2px 6px', color: 'var(--text-3)' }}>
                              {new Date(item.purchase_date).getFullYear()}
                            </span>
                          )}
                        </div>

                        {/* Conseil Nautilus */}
                        {item.timing_reasoning ? (
                          <div style={{ background: 'rgba(192,57,43,0.06)', border: '0.5px solid rgba(192,57,43,0.2)', borderRadius: 5, padding: '8px 10px', marginBottom: 10 }}>
                            <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: '#C0392B', textTransform: 'uppercase', marginBottom: 4 }}>Conseil Nautilus Intelligence</div>
                            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{item.timing_reasoning}</div>
                          </div>
                        ) : (
                          <div style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 5, padding: '8px 10px', marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                              {currentLang === 'fr' ? 'Nautilus analyse le marché...' : 'Nautilus is analysing the market...'}
                            </div>
                          </div>
                        )}

                        {/* Divider */}
                        <div style={{ borderTop: '0.5px solid var(--border)', marginBottom: 10 }} />

                        {/* 2-col action buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                          <button style={{ background: '#0A1628', color: 'white', border: 'none', borderRadius: 5, padding: '8px 0', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.04em' }}>
                            {currentLang === 'fr' ? 'Mettre en vente →' : 'List for sale →'}
                          </button>
                          <button style={{ background: 'transparent', color: 'var(--text-2)', border: '0.5px solid var(--border)', borderRadius: 5, padding: '8px 0', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                            {currentLang === 'fr' ? 'Courbe valeur' : 'Value curve'}
                          </button>
                        </div>

                        {/* Edit / delete row */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => editingId === item.id ? setEditingId(null) : openEditModal(item)}
                            style={{ fontSize: 10, color: 'var(--text-2)', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                          >
                            {currentLang === 'fr' ? (editingId === item.id ? 'Fermer' : 'Modifier') : (editingId === item.id ? 'Close' : 'Edit')}
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            disabled={deletingId === item.id}
                            style={{ fontSize: 10, color: '#C0392B', background: 'transparent', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 4, padding: '4px 8px', cursor: deletingId === item.id ? 'not-allowed' : 'pointer', opacity: deletingId === item.id ? 0.5 : 1, fontFamily: 'var(--font-mono)' }}
                          >
                            {deletingId === item.id ? '…' : '✕'}
                          </button>
                        </div>
                      </div>

                      {/* Inline edit */}
                      {editingId === item.id && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--bg-subtle)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                            {[
                              { label: 'Title', key: 'title', type: 'text' },
                              { label: 'Artist', key: 'artist_name', type: 'text' },
                              { label: 'Purchase Price', key: 'purchase_price_eur', type: 'number' },
                              { label: 'Current Value', key: 'estimated_current_value_eur', type: 'number' },
                              { label: 'Medium', key: 'medium', type: 'text' },
                              { label: 'Notes', key: 'notes', type: 'text' },
                            ].map(({ label, key, type }) => (
                              <div key={key}>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</label>
                                <input type={type} value={editForm[key as keyof EditForm]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleSaveEdit(item.id)} disabled={editLoading} style={{ padding: '7px 16px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '5px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: editLoading ? 'not-allowed' : 'pointer', opacity: editLoading ? 0.6 : 1 }}>
                              {editLoading ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '10px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add card */}
                <div
                  onClick={() => { setShowAddModal(true); setAddError(''); }}
                  style={{ background: 'var(--bg-subtle)', border: '2px dashed var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: '280px', gap: '8px', transition: 'all 0.2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--navy)'; el.style.background = 'rgba(10,22,40,0.03)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--bg-subtle)'; }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '22px', color: 'white', lineHeight: 1 }}>+</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: 600 }}>Add artwork</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Track value & performance</span>
                </div>
              </div>
            )}

            {/* AI Portfolio Analysis */}
            {portfolioItems.length >= 2 && (
              <div style={{ marginBottom: '40px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: 'var(--bg-subtle)', borderBottom: aiAnalysis ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>◎ AI Portfolio Analysis</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', padding: '2px 7px', borderRadius: '10px' }}>INVESTOR+</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Diversification · Risk assessment · Rebalancing recommendations</span>
                  </div>
                  <button onClick={generatePortfolioAnalysis} disabled={aiLoading} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: aiLoading ? 'var(--bg-hover)' : 'var(--navy)', color: aiLoading ? 'var(--text-3)' : 'white', fontSize: '11px', fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {aiLoading ? 'Analyzing...' : aiAnalysis ? '↺ Refresh' : '+ Analyze'}
                  </button>
                </div>
                {aiAnalysis && !aiAnalysis.insufficient_data && (
                  <div style={{ padding: '20px' }}>

                    {/* Verdict + Risk level row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      {aiAnalysis.verdict && (
                        <span style={{
                          fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '3px 10px', borderRadius: '4px',
                          background: aiAnalysis.verdict === 'EXCELLENT' ? 'var(--electric-subtle)' : aiAnalysis.verdict === 'GOOD' ? 'rgba(198,168,90,0.12)' : aiAnalysis.verdict === 'NEEDS_ATTENTION' ? 'rgba(220,140,0,0.12)' : 'var(--red-subtle)',
                          color: aiAnalysis.verdict === 'EXCELLENT' ? 'var(--electric)' : aiAnalysis.verdict === 'GOOD' ? 'var(--gold-dim)' : aiAnalysis.verdict === 'NEEDS_ATTENTION' ? '#c07000' : 'var(--red)',
                          border: `1px solid ${aiAnalysis.verdict === 'EXCELLENT' ? 'var(--electric-border)' : aiAnalysis.verdict === 'GOOD' ? 'var(--gold-border)' : aiAnalysis.verdict === 'NEEDS_ATTENTION' ? 'rgba(220,140,0,0.25)' : 'rgba(200,50,50,0.2)'}`,
                        }}>
                          {aiAnalysis.verdict.replace('_', ' ')}
                        </span>
                      )}
                      {aiAnalysis.risk_level && (
                        <span style={{
                          fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '3px 10px', borderRadius: '4px',
                          background: aiAnalysis.risk_level === 'LOW' ? 'var(--electric-subtle)' : aiAnalysis.risk_level === 'MODERATE' ? 'rgba(198,168,90,0.12)' : 'var(--red-subtle)',
                          color: aiAnalysis.risk_level === 'LOW' ? 'var(--electric)' : aiAnalysis.risk_level === 'MODERATE' ? 'var(--gold-dim)' : 'var(--red)',
                          border: `1px solid ${aiAnalysis.risk_level === 'LOW' ? 'var(--electric-border)' : aiAnalysis.risk_level === 'MODERATE' ? 'var(--gold-border)' : 'rgba(200,50,50,0.2)'}`,
                        }}>
                          RISK: {aiAnalysis.risk_level}
                        </span>
                      )}
                      {typeof aiAnalysis.total_pnl === 'number' && (
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: aiAnalysis.total_pnl >= 0 ? 'var(--electric)' : 'var(--red)', marginLeft: 'auto' }}>
                          P&amp;L: {aiAnalysis.total_pnl >= 0 ? '+' : ''}€{aiAnalysis.total_pnl.toLocaleString()} ({aiAnalysis.total_pnl_pct >= 0 ? '+' : ''}{aiAnalysis.total_pnl_pct}%)
                        </span>
                      )}
                    </div>

                    {/* Score metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
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

                    {/* Strengths & Risks */}
                    {(aiAnalysis.strengths?.length > 0 || aiAnalysis.risks?.length > 0) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        {aiAnalysis.strengths?.length > 0 && (
                          <div style={{ background: 'rgba(0,180,120,0.05)', border: '1px solid rgba(0,180,120,0.18)', borderRadius: '6px', padding: '12px 14px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '8px' }}>STRENGTHS</div>
                            {aiAnalysis.strengths.map((s: string, i: number) => (
                              <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                                <span style={{ color: 'var(--electric)', flexShrink: 0 }}>↑</span>
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {aiAnalysis.risks?.length > 0 && (
                          <div style={{ background: 'rgba(200,50,50,0.04)', border: '1px solid rgba(200,50,50,0.15)', borderRadius: '6px', padding: '12px 14px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '8px' }}>RISKS</div>
                            {aiAnalysis.risks.map((r: string, i: number) => (
                              <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                                <span style={{ color: 'var(--red)', flexShrink: 0 }}>↓</span>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Per-artwork insights */}
                    {aiAnalysis.artwork_insights?.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>Artwork Analysis</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {aiAnalysis.artwork_insights.map((insight: any, i: number) => {
                            const outlookColor = insight.outlook === 'sell' ? 'var(--red)' : insight.outlook === 'accumulate' ? 'var(--electric)' : insight.outlook === 'opportunistic sell' ? '#c07000' : 'var(--text-3)';
                            const standingColor = insight.market_standing === 'blue chip' ? 'var(--electric)' : insight.market_standing === 'established' ? 'var(--gold-dim)' : insight.market_standing === 'declining' || insight.market_standing === 'illiquid' ? 'var(--red)' : 'var(--text-2)';
                            return (
                              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 14px', background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                  <div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{insight.artist}</span>
                                    {insight.title && <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: '6px', fontStyle: 'italic' }}>— {insight.title}</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', background: 'var(--bg-subtle)', color: standingColor, border: '1px solid var(--border)' }}>
                                      {insight.market_standing?.toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', color: outlookColor, background: insight.outlook === 'sell' ? 'var(--red-subtle)' : insight.outlook === 'accumulate' ? 'var(--electric-subtle)' : 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                                      {insight.outlook?.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                  {insight.estimated_auction_range && insight.estimated_auction_range !== 'insufficient data' && (
                                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
                                      Auction range: <strong>{insight.estimated_auction_range}</strong>
                                    </span>
                                  )}
                                  {insight.liquidity && (
                                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                                      Liquidity: <strong style={{ color: insight.liquidity === 'high' ? 'var(--electric)' : insight.liquidity === 'low' ? 'var(--red)' : 'var(--gold-dim)' }}>{insight.liquidity}</strong>
                                    </span>
                                  )}
                                  {insight.acquisition_assessment && (
                                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                                      Acquired: <strong style={{ color: insight.acquisition_assessment === 'cheap' ? 'var(--electric)' : insight.acquisition_assessment === 'expensive' ? 'var(--red)' : 'var(--text-2)' }}>{insight.acquisition_assessment}</strong>
                                    </span>
                                  )}
                                </div>
                                {insight.commentary && (
                                  <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6, borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
                                    {insight.commentary}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {aiAnalysis.recommendations?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>Action Plan</div>
                        {aiAnalysis.recommendations.map((rec: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < aiAnalysis.recommendations.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', flexShrink: 0, marginTop: '2px', background: rec.priority === 'HIGH' ? 'var(--red-subtle)' : rec.priority === 'MEDIUM' ? 'var(--gold-subtle)' : 'var(--bg-subtle)', color: rec.priority === 'HIGH' ? 'var(--red)' : rec.priority === 'MEDIUM' ? 'var(--gold-dim)' : 'var(--text-3)' }}>
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
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>{aiAnalysis.message}</div>
                )}
              </div>
            )}

            {/* Market Opportunities */}
            <div style={{ paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text)', margin: '0 0 4px' }}>Market Opportunities</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>Top scoring lots right now — updated every 15 min</p>
                </div>
                <select
                  value={opportunitiesSort}
                  onChange={e => setOpportunitiesSort(e.target.value)}
                  style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="deal_score">Best score first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="date_asc">Closing soon</option>
                </select>
              </div>

              {isFreePlan && (
                <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px dashed var(--border)', marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text)', marginBottom: '8px' }}>Upgrade to see live opportunities</div>
                  <p style={{ fontSize: '13px', color: 'var(--text-3)', maxWidth: '360px', margin: '0 auto 20px' }}>Access real-time market opportunities matched to your collection profile.</p>
                  <button onClick={() => navigate('/app/pricing')} style={{ padding: '10px 28px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    View plans →
                  </button>
                </div>
              )}

              {lotsLoading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              )}

              {!lotsLoading && lotsError && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '16px' }}>{lotsError}</div>
                </div>
              )}

              {!lotsLoading && !lotsError && sortedLots.length > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                    {displayedLots.map(lot => (
                      <AlphaCard key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    <Link to="/app/explore" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', textDecoration: 'none', letterSpacing: '0.04em' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      View all opportunities →
                    </Link>
                  </div>
                </>
              )}

              {!lotsLoading && !lotsError && sortedLots.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--border)', marginBottom: '16px' }}>◇</div>
                  <div style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '6px' }}>No opportunities tracked yet</div>
                  <Link to="/app/opportunities" style={{ color: 'var(--navy)', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>Browse Opportunities</Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            RISK ANALYSIS TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'risk' && (
          <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 40px',textAlign:'center'}}>
            <div style={{display:'inline-block',background:'rgba(198,168,90,0.12)',color:'#C6A85A',fontSize:11,fontWeight:700,letterSpacing:'0.15em',padding:'4px 14px',borderRadius:2,marginBottom:16,textTransform:'uppercase'}}>
              Coming soon
            </div>
            <h3 style={{color:'#1A2A44',fontSize:20,fontWeight:400,fontFamily:'Georgia,serif',margin:'0 0 12px'}}>
              Portfolio Correlation Matrix
            </h3>
            <p style={{color:'#888',fontSize:14,lineHeight:1.7,maxWidth:440,margin:0}}>
              Understand concentration risk in your collection. See how your holdings move together — and where true diversification opportunities exist. Available in a future update.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            WATCHLIST TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'watchlist' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: '0 0 6px' }}>Auction Watchlist</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Lots you're monitoring — alerted 24h before closing</p>
              </div>
              <button onClick={() => navigate('/app/explore')} className="btn-electric" style={{ fontSize: '11px', padding: '8px 18px', borderRadius: '6px' }}>
                Browse lots →
              </button>
            </div>

            {watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 40px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--navy)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: '22px' }}>◎</span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '10px' }}>No lots on your watchlist</div>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px', maxWidth: '340px', margin: '0 auto 24px', lineHeight: 1.7 }}>
                  Browse opportunities and click "Watch" on any lot to track it here and receive closing alerts.
                </p>
                <button onClick={() => navigate('/app/explore')} className="btn-electric" style={{ fontSize: '12px', padding: '12px 28px', borderRadius: '6px' }}>
                  Find opportunities →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {watchlist.map((item: any) => {
                  const auctionDate = item.auction_date ? new Date(item.auction_date) : null;
                  const daysLeft = auctionDate ? Math.ceil((auctionDate.getTime() - Date.now()) / 86400000) : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
                  const isPast = daysLeft !== null && daysLeft < 0;
                  const isToday = daysLeft === 0;

                  return (
                    <div key={item.id} style={{
                      background: 'white',
                      border: `1px solid ${isUrgent ? 'var(--gold)' : 'var(--border)'}`,
                      borderLeft: `3px solid ${isUrgent ? 'var(--gold)' : isPast ? 'var(--border)' : 'var(--electric)'}`,
                      borderRadius: '8px', padding: '16px 20px',
                      display: 'flex', gap: '16px', alignItems: 'center',
                      opacity: isPast ? 0.6 : 1,
                      transition: 'box-shadow 0.15s',
                    }}
                      onMouseEnter={e => !isPast && ((e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
                    >
                      {/* Image */}
                      <div style={{ width: '72px', height: '72px', background: 'var(--bg-subtle)', borderRadius: '6px', flexShrink: 0, overflow: 'hidden' }}>
                        {item.image_url && <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {item.artist_name_raw || item.artist_name}
                          </span>
                          {item.deal_score >= 80 && (
                            <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--gold-dim)', background: 'var(--gold-subtle)', padding: '1px 6px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                              EXCEPTIONAL
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                          {item.title}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {item.current_price && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                              €{Number(item.current_price).toLocaleString()}
                            </span>
                          )}
                          {item.deal_score && (
                            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--electric)', background: 'var(--electric-subtle)', padding: '2px 7px', borderRadius: '3px', border: '1px solid var(--electric-border)' }}>
                              Score {item.deal_score}/100
                            </span>
                          )}
                          {item.auction_house_name && (
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{item.auction_house_name}</span>
                          )}
                          {isToday && (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', background: 'var(--red)', padding: '2px 8px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                              🔴 CLOSES TODAY
                            </span>
                          )}
                          {isUrgent && !isToday && (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold-dim)', background: 'var(--gold-subtle)', padding: '2px 8px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                              ⚡ {daysLeft}d left
                            </span>
                          )}
                          {!isUrgent && !isPast && daysLeft !== null && (
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                              {auctionDate?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {daysLeft}d
                            </span>
                          )}
                          {isPast && <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>Auction ended</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {!isPast && (
                          <button
                            onClick={() => navigate(`/app/opportunities/${item.lot_id}`)}
                            style={{ padding: '7px 14px', background: 'var(--navy)', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: 'white', cursor: 'pointer', letterSpacing: '0.04em' }}
                          >
                            View →
                          </button>
                        )}
                        <button
                          onClick={() => removeFromWatchlist(item.id)}
                          style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ARTISTS TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'artists' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: '0 0 6px' }}>Favorite Artists</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Follow artists — get alerted when their works appear on Nautilus</p>
              </div>
              <button onClick={() => setShowAddArtist(true)} className="btn-electric" style={{ fontSize: '11px', padding: '8px 18px', borderRadius: '6px' }}>
                + Follow artist
              </button>
            </div>

            {favoriteArtists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 40px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--navy)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#C6A85A', fontSize: '22px' }}>★</span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '10px' }}>No favorite artists yet</div>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px', maxWidth: '340px', margin: '0 auto 24px', lineHeight: 1.7 }}>
                  Follow Picasso, Basquiat, or any artist — and be the first to know when their work appears on the market.
                </p>
                <button onClick={() => setShowAddArtist(true)} className="btn-electric" style={{ fontSize: '12px', padding: '12px 28px', borderRadius: '6px' }}>
                  Follow your first artist →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {favoriteArtists.map((artist: any) => (
                  <div key={artist.id} style={{
                    background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px',
                    transition: 'box-shadow 0.15s',
                  }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                          {artist.artist_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          Since {new Date(artist.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFavoriteArtist(artist.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0' }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Alert toggles */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { key: 'alert_new_lot', label: 'New lot on Nautilus', sub: 'Instant alert' },
                        { key: 'alert_price_change', label: 'Price movement', sub: 'Market signal' },
                      ].map(({ key, label, sub }) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{sub}</div>
                          </div>
                          <div
                            onClick={() => toggleArtistAlert(artist.id, key, !artist[key])}
                            style={{
                              width: '36px', height: '20px', borderRadius: '10px',
                              background: artist[key] !== false ? 'var(--electric)' : 'var(--bg-hover)',
                              cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                            }}
                          >
                            <div style={{
                              position: 'absolute', top: '2px',
                              left: artist[key] !== false ? '17px' : '2px',
                              width: '16px', height: '16px', borderRadius: '50%',
                              background: 'white', transition: 'left 0.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => navigate(`/app/explore?tab=best&search=${encodeURIComponent(artist.artist_name)}`)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--navy)'; (e.currentTarget as HTMLButtonElement).style.color = 'white'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                    >
                      See lots on Nautilus →
                    </button>
                  </div>
                ))}

                {/* Add artist card */}
                <div
                  onClick={() => setShowAddArtist(true)}
                  style={{
                    background: 'var(--bg-subtle)', border: '2px dashed var(--border)', borderRadius: '8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', minHeight: '180px', gap: '8px', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--navy)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '20px', lineHeight: 1 }}>+</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: 600 }}>Follow an artist</span>
                </div>
              </div>
            )}

            {/* Add artist modal */}
            {showAddArtist && (
              <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
                onClick={e => { if (e.target === e.currentTarget) setShowAddArtist(false); }}
              >
                <div style={{ background: 'white', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '420px' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '6px' }}>Follow an artist</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '20px' }}>You'll be notified when their work appears on Nautilus.</p>
                  <input
                    className="input"
                    placeholder="Artist name, e.g. Joan Miró, Basquiat..."
                    value={newArtistName}
                    onChange={e => setNewArtistName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFavoriteArtist()}
                    style={{ marginBottom: '16px', width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => { setShowAddArtist(false); setNewArtistName(''); }}
                      style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addFavoriteArtist}
                      disabled={!newArtistName.trim()}
                      className="btn-electric"
                      style={{ flex: 1, fontSize: '13px', padding: '11px', justifyContent: 'center', borderRadius: '8px', opacity: newArtistName.trim() ? 1 : 0.4 }}
                    >
                      Follow →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ALERTS TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'alerts' && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: '0 0 6px' }}>Alert Center</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Configure exactly when Nautilus contacts you — and how</p>
            </div>

            {!hasAccess && (
              <div style={{textAlign:'center',padding:'32px 24px',background:'#f8f8f6',borderRadius:8,marginBottom:24,border:'1px solid #e8e4dc'}}>
                <div style={{fontSize:11,letterSpacing:'0.2em',color:'#C6A85A',marginBottom:8,fontWeight:700}}>INVESTOR+ FEATURE</div>
                <div style={{fontSize:18,fontFamily:'Georgia,serif',color:'#1A2A44',marginBottom:8}}>Alerts are available from the Investor plan</div>
                <a href="/app/pricing" style={{display:'inline-block',background:'#2563EB',color:'#fff',padding:'12px 28px',fontSize:13,fontWeight:600,textDecoration:'none',borderRadius:4}}>Unlock alerts — €19/mo →</a>
              </div>
            )}

            <div style={!hasAccess ? {pointerEvents:'none' as const,opacity:0.5} : {}}>
            {[
              {
                title: 'Market signals',
                subtitle: 'Real-time opportunities',
                icon: '◆',
                color: 'var(--gold)',
                alerts: [
                  { key: 'notify_exceptional_deals', label: 'Exceptional opportunity detected', sub: 'Score ≥ 80 — immediate email notification' },
                  { key: 'notify_price_alert', label: 'Lot priced below market value', sub: 'When estimate is 30%+ below comparable sales' },
                  { key: 'notify_new_auction', label: 'New auction house added', sub: 'When Nautilus integrates a new source' },
                ]
              },
              {
                title: 'Artist alerts',
                subtitle: 'Your followed artists',
                icon: '★',
                color: 'var(--electric)',
                alerts: [
                  { key: 'notify_new_lot_by_artist', label: 'New lot by followed artist', sub: 'When a work by one of your artists appears' },
                  { key: 'notify_artist_momentum', label: 'Artist momentum change', sub: "When an artist's market score rises significantly" },
                  { key: 'notify_artist_exhibition', label: 'Exhibition or auction result', sub: 'Major events for artists you follow' },
                ]
              },
              {
                title: 'Auction alerts',
                subtitle: 'Your watchlist',
                icon: '⏱',
                color: 'var(--navy)',
                alerts: [
                  { key: 'notify_auction_reminder', label: 'Auction closing in 24h', sub: 'For lots on your watchlist' },
                  { key: 'notify_auction_result', label: 'Auction result available', sub: 'Final hammer price after the sale' },
                  { key: 'notify_outbid', label: 'Estimate revised', sub: "When a lot's estimate is updated" },
                ]
              },
              {
                title: 'Portfolio alerts',
                subtitle: 'Your collection',
                icon: '◈',
                color: 'var(--electric)',
                alerts: [
                  { key: 'notify_portfolio_value', label: 'Portfolio value change ±10%', sub: 'Based on comparable market sales' },
                  { key: 'notify_sell_opportunity', label: 'Optimal sell window detected', sub: 'When market conditions favour selling a work you own' },
                  { key: 'notify_similar_lot_selling', label: 'Similar work going to auction', sub: 'A comparable work is selling — useful for valuation' },
                ]
              },
              {
                title: 'Intelligence reports',
                subtitle: 'Weekly & monthly briefings',
                icon: '◐',
                color: 'var(--text-2)',
                alerts: [
                  { key: 'notify_weekly_brief', label: 'Weekly market brief', sub: 'Every Monday 8am — top 5 opportunities + market recap' },
                  { key: 'notify_monthly_report', label: 'Monthly portfolio report', sub: 'Performance, trends, and AI recommendations' },
                  { key: 'notify_email', label: 'Email notifications', sub: 'Master switch — all alerts sent by email' },
                ]
              },
            ].map(({ title, subtitle, icon, color, alerts: alertGroup }) => (
              <div key={title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px 24px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '14px', color }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{subtitle}</div>
                  </div>
                </div>

                {alertGroup.map(({ key, label, sub }, idx) => (
                  <div key={key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: idx < alertGroup.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <div style={{ flex: 1, paddingRight: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>{sub}</div>
                    </div>
                    <div
                      onClick={() => toggleNotification(key)}
                      style={{
                        width: '44px', height: '24px', borderRadius: '12px',
                        background: notificationPrefs[key] !== false ? 'var(--electric)' : '#E2E8F0',
                        cursor: 'pointer', position: 'relative', transition: 'background 0.25s',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: '3px',
                        left: notificationPrefs[key] !== false ? '21px' : '3px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: 'white', transition: 'left 0.25s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
              <button
                onClick={saveNotificationPrefs}
                className="btn-electric"
                style={{ fontSize: '12px', padding: '11px 28px', borderRadius: '8px' }}
              >
                Save preferences
              </button>
              {settingsSaved && (
                <span style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600 }}>✓ Saved</span>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SUBSCRIPTION TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'subscription' && (
          <div className="animate-fade-in">
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: '0 0 24px' }}>Subscription</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}><div>

            {/* Current plan hero card */}
            <div style={{
              background: 'var(--navy)', borderRadius: '12px', padding: '32px',
              marginBottom: '16px', position: 'relative', overflow: 'hidden',
            }}>
              {/* Decorative spiral */}
              <div style={{ position: 'absolute', right: '24px', top: '24px', opacity: 0.08 }}>
                <svg width="120" height="120" viewBox="0 0 40 40" fill="none">
                  <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.65"/>
                  <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M 12 28 A 8 8 0 0 1 20 20" stroke="#C6A85A" strokeWidth="2.2" strokeLinecap="round" opacity="0.7"/>
                  <circle cx="20" cy="20" r="1.8" fill="#C6A85A"/>
                </svg>
              </div>

              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', marginBottom: '10px' }}>
                CURRENT PLAN
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 600, color: 'white', marginBottom: '6px', textTransform: 'capitalize' }}>
                {subscription?.plan || userPlan || 'Explorer'}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
                {subscription?.status === 'active'
                  ? 'Active · Renews automatically'
                  : subscription?.status === 'trialing'
                  ? `Free trial · Ends ${subscription?.trial_end ? new Date(subscription.trial_end * 1000).toLocaleDateString('fr-FR') : 'soon'}`
                  : 'Free plan — upgrade to unlock the full platform'
                }
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => navigate('/app/pricing')}
                  style={{
                    padding: '10px 24px', background: 'white', color: 'var(--navy)',
                    border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '0.06em',
                  }}
                >
                  {userPlan === 'free' ? 'Upgrade plan →' : 'Change plan →'}
                </button>
                {subscription?.status === 'active' && (
                  <button
                    onClick={openBillingPortal}
                    style={{
                      padding: '10px 24px', background: 'transparent', color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Manage billing
                  </button>
                )}
              </div>
            </div>

            {/* Plan features summary */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px 24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
                Your plan includes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(userPlan === 'free' ? [
                  '3 opportunities/day',
                  'Basic deal score',
                  '3 Larry messages',
                  '3 portfolio items',
                ] : userPlan === 'starter' ? [
                  '10 opportunities/day',
                  'Full deal score + rationale',
                  '10 Larry messages/month',
                  'Primary market access',
                  '10 portfolio items',
                  'Market signals & alerts',
                ] : userPlan === 'investor' ? [
                  'Unlimited opportunities',
                  'Investment Memo generator',
                  '30 Larry messages/month',
                  '3 AI agent strategies',
                  'Full artist profiles',
                  'Priority support',
                ] : [
                  'Everything in Investor',
                  'Investment Dossier (50yr)',
                  'Unlimited Larry',
                  'Unlimited AI analyses',
                  'API access',
                  'Dedicated support',
                ]).map((feature, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--electric)', fontSize: '12px' }}>✓</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{feature}</span>
                  </div>
                ))}
              </div>
              {userPlan !== 'pro' && userPlan !== 'institutional' && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Want more? Upgrade for unlimited access.</span>
                  <button onClick={() => navigate('/app/pricing')} style={{ fontSize: '11px', color: 'var(--electric)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                    See all plans →
                  </button>
                </div>
              )}
            </div>
            </div><div>

            {/* Stripe billing portal */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px 24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Billing & Payments
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px', lineHeight: 1.6 }}>
                Update your payment method, download invoices, and manage your subscription directly in the Stripe billing portal.
              </p>
              <button
                onClick={openBillingPortal}
                style={{
                  width: '100%', padding: '12px', background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--navy)'; (e.currentTarget as HTMLButtonElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
              >
                <span>Open Stripe billing portal</span>
                <span>→</span>
              </button>
            </div>

            {/* Invoices */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px 24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
                Invoice History
              </div>
              {invoices.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                  No invoices yet — they'll appear here after your first payment.
                </p>
              ) : (
                <div>
                  {invoices.map((inv: any, idx: number) => (
                    <div key={inv.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: idx < invoices.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                          {new Date(inv.created * 1000).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {(inv.amount_paid / 100).toFixed(2)} {inv.currency?.toUpperCase()} · {inv.description || 'Nautilus subscription'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                          padding: '2px 8px', borderRadius: '10px',
                          color: inv.status === 'paid' ? 'var(--electric)' : 'var(--red)',
                          background: inv.status === 'paid' ? 'var(--electric-subtle)' : 'var(--red-subtle)',
                          border: `1px solid ${inv.status === 'paid' ? 'var(--electric-border)' : 'var(--red-border)'}`,
                        }}>
                          {inv.status?.toUpperCase()}
                        </span>
                        {inv.invoice_pdf && (
                          <a
                            href={inv.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '11px', color: 'var(--electric)', fontWeight: 700,
                              padding: '4px 10px', borderRadius: '4px',
                              border: '1px solid var(--electric-border)',
                              background: 'var(--electric-subtle)',
                              textDecoration: 'none',
                            }}
                          >
                            ↓ PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger zone */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px 24px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
                Danger Zone
              </div>

              {subscription?.status === 'active' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>Cancel subscription</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Your access continues until the end of the billing period.</div>
                  </div>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--red)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--red)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Cancel plan
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>Delete my account</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Permanently delete all your data. This cannot be undone.</div>
                </div>
                <button
                  onClick={openDeleteModal}
                  style={{ padding: '8px 16px', background: 'var(--red)', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Delete account
                </button>
              </div>
            </div>
            </div></div>

            {/* Cancel modal */}
            {showCancelModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '420px', width: '100%' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '12px' }}>Cancel subscription?</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: 1.7 }}>
                    Your access will continue until the end of the current billing period. After that, you'll be downgraded to the free plan.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowCancelModal(false)} style={{ flex: 1, padding: '11px', background: 'var(--navy)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                      Keep my plan
                    </button>
                    <button onClick={handleCancelSubscription} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid var(--red)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--red)', cursor: 'pointer' }}>
                      Cancel anyway
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete account modal — 3 states: loading / confirm / success */}
            {deleteModalState !== null && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div style={{ background: 'white', borderRadius: '12px', maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>

                  {/* Loading */}
                  {deleteModalState === 'loading' && (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>Loading account information…</div>
                    </div>
                  )}

                  {/* Confirm */}
                  {deleteModalState === 'confirm' && (
                    <>
                      <div style={{ height: '4px', background: '#dc2626' }} />
                      <div style={{ padding: '32px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: '#dc2626', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>NAUTILUS</div>
                          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#1a2a44', margin: 0 }}>Delete your Nautilus account</h3>
                        </div>

                        <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7, marginBottom: '20px' }}>
                          {(!deleteInfo || deleteInfo.billing_interval === 'free') && (
                            <>Your account and all personal data will be permanently anonymized immediately. You will be logged out and will no longer be able to access Nautilus.</>
                          )}
                          {deleteInfo?.billing_interval === 'monthly' && (
                            <>Your Nautilus subscription will not be renewed. You will retain full access until{' '}
                            <strong>{deleteInfo.subscription_end_date ? new Date(deleteInfo.subscription_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of your billing period'}</strong>.
                            {' '}After this date, your account will be permanently anonymized.</>
                          )}
                          {deleteInfo?.billing_interval === 'yearly' && (
                            <>You are currently committed to an annual plan. Your subscription will not be renewed at the end of your commitment period ({deleteInfo.subscription_end_date ? <strong>{new Date(deleteInfo.subscription_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong> : 'end of period'}). You will retain full access until that date. No refund will be issued for the remaining period in accordance with our Terms of Service.</>
                          )}
                        </div>

                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '14px 16px', marginBottom: '24px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
                            In accordance with the General Data Protection Regulation (GDPR), your personal data (name, email, phone) will be anonymized immediately upon confirmation. Anonymized transaction records will be retained for up to 7 years for legal and accounting compliance. You may request a copy of your data before deletion by contacting{' '}
                            <a href="mailto:privacy@get-nautilus.com" style={{ color: '#6b7280' }}>privacy@get-nautilus.com</a>
                          </div>
                        </div>

                        {deleteError && (
                          <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '16px', padding: '10px 12px', background: '#fef2f2', borderRadius: '6px' }}>{deleteError}</div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => { setDeleteModalState(null); setDeleteError(''); }}
                            style={{ flex: 1, padding: '11px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDeleteAccount}
                            style={{ flex: 1, padding: '11px', background: '#dc2626', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer' }}
                          >
                            Confirm deletion
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Success */}
                  {deleteModalState === 'success' && (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#1a2a44', marginBottom: '8px' }}>Your account has been scheduled for deletion.</h3>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Your personal data has been anonymized.</p>
                      <p style={{ fontSize: '13px', color: '#9ca3af' }}>You will be logged out in 3 seconds.</p>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SETTINGS TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in">
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: '0 0 24px' }}>Account Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}><div>

            {/* Profile */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '18px' }}>
                Personal Information
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Full name</label>
                  <input style={inputStyle} value={settingsForm.fullName} onChange={e => setSettingsForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</label>
                  <input style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} value={user?.email || ''} disabled />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Phone</label>
                  <input style={inputStyle} value={settingsForm.phone} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33 6 00 00 00 00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Country</label>
                  <select style={inputStyle} value={settingsForm.country} onChange={e => setSettingsForm(f => ({ ...f, country: e.target.value }))}>
                    <option value="">Select country</option>
                    <option value="FR">France</option>
                    <option value="BE">Belgium</option>
                    <option value="CH">Switzerland</option>
                    <option value="LU">Luxembourg</option>
                    <option value="MC">Monaco</option>
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="AE">UAE</option>
                    <option value="SG">Singapore</option>
                    <option value="HK">Hong Kong</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Address</label>
                  <input style={inputStyle} value={settingsForm.address} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Rue de Rivoli, 75001 Paris" />
                </div>
              </div>
            </div>
            </div><div>

            {/* Investment profile */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '18px' }}>
                Investment Profile
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Investor type</label>
                  <select style={inputStyle} value={settingsForm.collectorType} onChange={e => setSettingsForm(f => ({ ...f, collectorType: e.target.value }))}>
                    <option value="">Select type</option>
                    <option value="first_time">First-time buyer</option>
                    <option value="collector">Art collector</option>
                    <option value="investor">Pure investor</option>
                    <option value="family_office">Family office / Wealth manager</option>
                    <option value="gallery">Gallery or art dealer</option>
                    <option value="institution">Institution / Museum</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Investment horizon</label>
                  <select style={inputStyle} value={settingsForm.horizon} onChange={e => setSettingsForm(f => ({ ...f, horizon: e.target.value }))}>
                    <option value="">Select horizon</option>
                    <option value="short">{'Short term (< 2 years)'}</option>
                    <option value="medium">Medium term (2–5 years)</option>
                    <option value="long">Long term (5+ years)</option>
                    <option value="permanent">Permanent collection</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Annual budget (€)</label>
                  <input style={inputStyle} type="number" value={settingsForm.annualBudget} onChange={e => setSettingsForm(f => ({ ...f, annualBudget: e.target.value }))} placeholder="e.g. 50000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Expected annual return (%)</label>
                  <input style={inputStyle} type="number" value={settingsForm.expectedReturn} onChange={e => setSettingsForm(f => ({ ...f, expectedReturn: e.target.value }))} placeholder="e.g. 15" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preferred art styles & movements</label>
                  <input style={inputStyle} value={settingsForm.preferredStyles} onChange={e => setSettingsForm(f => ({ ...f, preferredStyles: e.target.value }))} placeholder="e.g. Impressionism, Contemporary, Street Art, Photography..." />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preferred regions & schools</label>
                  <input style={inputStyle} value={settingsForm.preferredRegions} onChange={e => setSettingsForm(f => ({ ...f, preferredRegions: e.target.value }))} placeholder="e.g. French school, American abstract, Asian contemporary..." />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Currency display</label>
                  <select style={inputStyle} value={settingsForm.currency} onChange={e => setSettingsForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Language</label>
                  <select style={inputStyle}
                    value={settingsForm.language}
                    onChange={e => { localStorage.setItem('i18nextLng', e.target.value); i18n.changeLanguage(e.target.value); setSettingsForm(f => ({ ...f, language: e.target.value })); }}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>What do you want to achieve with Nautilus?</label>
                  <textarea
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                    value={settingsForm.goals}
                    onChange={e => setSettingsForm(f => ({ ...f, goals: e.target.value }))}
                    placeholder="e.g. Build a diversified collection of 20 works under €500K, find undervalued impressionist prints, resell within 3 years at +30%..."
                  />
                </div>
              </div>
            </div>
            </div></div>

            {/* Save */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={saveSettings}
                className="btn-electric"
                style={{ fontSize: '13px', padding: '12px 32px', borderRadius: '8px' }}
              >
                Save changes
              </button>
              {settingsSaved && (
                <span style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ✓ Saved successfully
                </span>
              )}
            </div>

            {/* Delete account */}
            <div style={{ marginTop: '48px', textAlign: 'center' }}>
              <button
                onClick={openDeleteModal}
                style={{ color: '#dc2626', background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Delete my account
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
