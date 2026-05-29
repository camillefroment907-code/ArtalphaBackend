import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`;
  return `€${Math.round(n)}`;
}

function fmtDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ height: '200px', background: '#F0EDE8', position: 'relative' }}>
        <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="skeleton" style={{ height: '9px',  width: '50%', borderRadius: '3px' }} />
        <div className="skeleton" style={{ height: '14px', width: '85%', borderRadius: '3px' }} />
        <div className="skeleton" style={{ height: '10px', width: '60%', borderRadius: '3px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <div className="skeleton" style={{ height: '13px', width: '35%', borderRadius: '3px' }} />
          <div className="skeleton" style={{ height: '20px', width: '28px', borderRadius: '4px' }} />
        </div>
      </div>
    </div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({ lot, lang, onClick }: { lot: any; lang: string; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const matchScore  = lot.match_score  ?? 0;
  const dealScore   = lot.deal_score   ?? 0;
  const daysLeft    = lot.days_until_close;
  const reasons     = lot.match_reasons || [];

  const matchColor =
    matchScore >= 80 ? '#1A6B3C' :
    matchScore >= 60 ? '#B8922A' : '#6B7280';
  const matchBg =
    matchScore >= 80 ? 'rgba(26,107,60,0.08)' :
    matchScore >= 60 ? 'rgba(184,146,42,0.08)' : 'rgba(107,114,128,0.08)';

  const urgentDays = daysLeft != null && daysLeft <= 7;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px',
        cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = '#1A2A44';
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 4px 16px rgba(26,42,68,0.08)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = '#E8E4DC';
        el.style.transform = 'none';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Image */}
      <div style={{ height: '200px', background: '#F7F4EF', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {!imgLoaded && !imgError && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
        {lot.image_url && !imgError ? (
          <img
            src={lot.image_url} alt={lot.title} loading="lazy"
            onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top',
                     opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '28px', opacity: 0.15 }}>◇</span>
          </div>
        )}

        {/* Match score badge — top left */}
        <div style={{
          position: 'absolute', top: '10px', left: '10px',
          background: matchBg, border: `1px solid ${matchColor}33`,
          borderRadius: '5px', padding: '3px 8px',
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
          color: matchColor, backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <span style={{ fontSize: '8px' }}>◎</span> {matchScore}
        </div>

        {/* Urgency badge — top right */}
        {urgentDays && (
          <div style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'rgba(192,57,43,0.9)', borderRadius: '5px', padding: '3px 8px',
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white',
          }}>
            {daysLeft === 0
              ? (lang === 'fr' ? 'Aujourd\'hui' : 'Today')
              : `${daysLeft}j`}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {lot.artist || '—'}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2A44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.title || '—'}
        </div>

        {/* Reasons */}
        {reasons.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
            {reasons.slice(0, 2).map((r: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: matchColor, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.4 }}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              {fmtPrice(lot.price)}
            </div>
            {lot.auction_house && (
              <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                {lot.auction_house}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
            {dealScore > 0 && (
              <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                {lang === 'fr' ? 'Score' : 'Score'} {dealScore}/100
              </div>
            )}
            {lot.auction_date && (
              <div style={{ fontSize: '10px', color: daysLeft != null && daysLeft <= 14 ? '#B8922A' : '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                {fmtDate(lot.auction_date, lang)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tier pill ─────────────────────────────────────────────────────────────────

function TierPill({ tier, lang }: { tier: string; lang: string }) {
  const label: Record<string, Record<string, string>> = {
    fr: { blue_chip: 'Blue Chip', established: 'Établi', emerging: 'Émergent', unknown: 'Non attribué' },
    en: { blue_chip: 'Blue Chip', established: 'Established', emerging: 'Emerging', unknown: 'Unknown' },
  };
  const color: Record<string, string> = {
    blue_chip: '#1A2A44', established: '#B8922A', emerging: '#1A6B3C', unknown: '#9CA3AF',
  };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '12px',
      background: `${color[tier] ?? '#9CA3AF'}15`,
      border: `1px solid ${color[tier] ?? '#9CA3AF'}30`,
      fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
      color: color[tier] ?? '#9CA3AF',
    }}>
      {(label[lang] ?? label.en)[tier] ?? tier}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SortKey = 'match_score' | 'deal_score' | 'price_asc' | 'price_desc' | 'date';

export default function CollectionMatch() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortKey>('match_score');
  const [tierFilter, setTierFilter] = useState<string>('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BACKEND}/api/collection-os/match`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Sort + filter
  const allLots: any[] = data?.lots ?? [];
  const tiers = [...new Set(allLots.map((l: any) => l.artist_tier).filter(Boolean))] as string[];

  const sorted = [...allLots]
    .filter((l: any) => !tierFilter || l.artist_tier === tierFilter)
    .sort((a: any, b: any) => {
      if (sort === 'match_score') return (b.match_score ?? 0) - (a.match_score ?? 0);
      if (sort === 'deal_score')  return (b.deal_score  ?? 0) - (a.deal_score  ?? 0);
      if (sort === 'price_asc')   return (a.price ?? 0) - (b.price ?? 0);
      if (sort === 'price_desc')  return (b.price ?? 0) - (a.price ?? 0);
      if (sort === 'date') {
        const da = a.auction_date ? new Date(a.auction_date).getTime() : Infinity;
        const db = b.auction_date ? new Date(b.auction_date).getTime() : Infinity;
        return da - db;
      }
      return 0;
    });

  const profile  = data?.profile;
  const isLimited = data?.is_limited;
  const total    = data?.total_matches ?? 0;

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: 'match_score', label: lang === 'fr' ? 'Meilleure correspondance' : 'Best match' },
    { key: 'deal_score',  label: lang === 'fr' ? 'Meilleur score'           : 'Best score' },
    { key: 'price_asc',   label: lang === 'fr' ? 'Prix croissant'           : 'Price: low–high' },
    { key: 'price_desc',  label: lang === 'fr' ? 'Prix décroissant'         : 'Price: high–low' },
    { key: 'date',        label: lang === 'fr' ? 'Clôture imminente'        : 'Closing soon' },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: '#FAFAF8' }}>

      {/* ── HEADER ── */}
      <div style={{ background: '#0D1F35', color: 'white', padding: '28px 48px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1A6B3C' }} />
          Nautilus Collection OS · Collection Match
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 600, color: 'white', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              {lang === 'fr' ? 'Sélectionnés pour vous' : 'Selected for you'}
            </h1>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              {loading ? '…' : total > 0
                ? (lang === 'fr'
                    ? `${total} lots correspondent à votre profil de collection`
                    : `${total} lots match your collection profile`)
                : (lang === 'fr'
                    ? 'Aucune correspondance pour le moment'
                    : 'No matches yet')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/portfolio')}
            style={{ flexShrink: 0, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '7px', padding: '9px 18px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            {lang === 'fr' ? '← Ma collection' : '← My collection'}
          </button>
        </div>

        {/* Profile summary strip */}
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '18px', paddingTop: '16px', borderTop: '0.5px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
                {lang === 'fr' ? 'Profil' : 'Profile'}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(profile.tiers || []).map((t: string) => (
                  <TierPill key={t} tier={t} lang={lang} />
                ))}
              </div>
            </div>
            {profile.price_range && (
              <div>
                <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {lang === 'fr' ? 'Gamme de prix' : 'Price range'}
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
                  {fmtPrice(profile.price_range.min)} – {fmtPrice(profile.price_range.max)}
                  <span style={{ marginLeft: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                    sweet spot {fmtPrice(profile.price_range.sweet_spot)}
                  </span>
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
                {lang === 'fr' ? 'Collection' : 'Collection'}
              </div>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
                {profile.artist_count} {lang === 'fr' ? 'œuvre' : 'artwork'}{profile.artist_count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FILTERS BAR ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #E8E4DC', padding: '12px 48px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{ padding: '6px 12px', border: '1px solid #E8E4DC', borderRadius: '6px', fontSize: '12px', background: '#FAFAF8', color: '#374151', cursor: 'pointer', outline: 'none' }}
        >
          {SORT_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        {/* Tier filter pills */}
        {tiers.length > 1 && (
          <div style={{ display: 'flex', gap: '5px' }}>
            {['', ...tiers].map(t => {
              const active = tierFilter === t;
              const label = t === '' ? (lang === 'fr' ? 'Tous' : 'All') :
                ({ blue_chip: 'Blue Chip', established: lang === 'fr' ? 'Établi' : 'Established', emerging: lang === 'fr' ? 'Émergent' : 'Emerging', unknown: lang === 'fr' ? 'Non attribué' : 'Unknown' }[t] ?? t);
              return (
                <button key={t} onClick={() => setTierFilter(t)} style={{
                  padding: '5px 13px', borderRadius: '20px', border: `1px solid ${active ? '#1A2A44' : '#E8E4DC'}`,
                  background: active ? '#1A2A44' : 'transparent',
                  color: active ? 'white' : '#6B7280',
                  fontSize: '11px', fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s',
                }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#9CA3AF' }}>
          {sorted.length} {lang === 'fr' ? 'résultats' : 'results'}
          {isLimited && (
            <button onClick={() => navigate('/app/pricing')} style={{ marginLeft: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#B8922A', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              + {total - allLots.length} {lang === 'fr' ? 'masqués · Upgrade →' : 'hidden · Upgrade →'}
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '36px 48px' }}>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* No portfolio */}
        {!loading && !data?.profile && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '32px', color: '#E8E4DC', marginBottom: '16px' }}>◇</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#1A2A44', marginBottom: '8px' }}>
              {lang === 'fr' ? 'Aucune collection détectée' : 'No collection detected'}
            </div>
            <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '360px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              {lang === 'fr'
                ? 'Ajoutez vos premières œuvres au portfolio pour que Nautilus identifie les lots qui correspondent à votre profil.'
                : 'Add your first artworks to your portfolio so Nautilus can identify lots that match your profile.'}
            </p>
            <button
              onClick={() => navigate('/app/portfolio')}
              style={{ padding: '11px 24px', background: '#1A2A44', color: '#C6A85A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em' }}
            >
              {lang === 'fr' ? 'Ajouter des œuvres →' : 'Add artworks →'}
            </button>
          </div>
        )}

        {/* No matches */}
        {!loading && data?.profile && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#1A2A44', marginBottom: '8px' }}>
              {lang === 'fr' ? 'Aucun lot correspondant' : 'No matching lots'}
            </div>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px' }}>
              {tierFilter
                ? (lang === 'fr' ? 'Essayez un autre filtre.' : 'Try a different filter.')
                : (lang === 'fr' ? 'Revenez demain — la base est mise à jour deux fois par jour.' : 'Check back tomorrow — the feed updates twice daily.')}
            </p>
            {tierFilter && (
              <button onClick={() => setTierFilter('')} style={{ background: 'none', border: '1px solid #E8E4DC', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', color: '#374151' }}>
                {lang === 'fr' ? 'Effacer le filtre' : 'Clear filter'}
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && sorted.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {sorted.map((lot: any) => (
                <MatchCard
                  key={lot.id}
                  lot={lot}
                  lang={lang}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                />
              ))}
            </div>

            {/* Upgrade CTA when limited */}
            {isLimited && (
              <div style={{ marginTop: '40px', background: 'white', border: '1px solid #E8E4DC', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: '#1A2A44', marginBottom: '8px' }}>
                  {lang === 'fr'
                    ? `${total - allLots.length} correspondances supplémentaires disponibles`
                    : `${total - allLots.length} more matches available`}
                </div>
                <p style={{ fontSize: '13px', color: '#6B7280', maxWidth: '400px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                  {lang === 'fr'
                    ? 'Passez à Investor pour voir toutes vos correspondances et recevoir des alertes en temps réel.'
                    : 'Upgrade to Investor to see all your matches and get real-time alerts.'}
                </p>
                <button
                  onClick={() => navigate('/app/pricing')}
                  style={{ padding: '11px 28px', background: '#1A2A44', color: '#C6A85A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}
                >
                  {lang === 'fr' ? 'Voir les plans →' : 'View plans →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
