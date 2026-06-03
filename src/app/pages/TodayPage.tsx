import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LotCard {
  id: string;
  title: string | null;
  artist_name_raw: string | null;
  current_price: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_date: string | null;
  auction_house_name: string | null;
  category: string | null;
  status: string | null;
}

interface Brief {
  since: string;
  generated_at: string;
  new_lots_count: number;
  closing_today_count: number;
  new_lots: LotCard[];
  closing_soon: LotCard[];
  top_deal: LotCard | null;
  agent_unread: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

function hoursLeft(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3600000;
}

function formatCountdown(iso: string): string {
  const h = hoursLeft(iso);
  if (h <= 0) return 'terminée';
  if (h < 1) return `${Math.floor(h * 60)} min`;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  const rem = Math.floor(h % 24);
  return rem > 0 ? `${d}j ${rem}h` : `${d}j`;
}

function buildConvictionPhrase(lot: LotCard): string {
  const pct   = lot.pct_below_low_estimate;
  const score = lot.deal_score;
  const h     = lot.auction_date ? hoursLeft(lot.auction_date) : null;

  if (pct && pct >= 20 && h !== null && h > 0 && h < 48) {
    return `Estimé ${Math.round(pct)} % sous sa valeur de référence et vente dans moins de ${h < 24 ? '24' : '48'} heures — la fenêtre pour agir se referme.`;
  }
  if (pct && pct >= 20) {
    return `Notre analyse identifie une anomalie de prix de ${Math.round(pct)} % sous l'estimation basse — un écart que le marché corrige généralement rapidement.`;
  }
  if (pct && pct >= 10) {
    return `Sous l'estimation basse de ${Math.round(pct)} % — le rapport valeur/risque est parmi les plus favorables que nous ayons identifiés sur ce type d'œuvre.`;
  }
  if (h !== null && h > 0 && h < 24) {
    return `Vente dans moins de 24 heures. À ce prix, notre analyse place ce lot parmi les opportunités les plus singulières de la semaine.`;
  }
  if (score && score >= 82) {
    return `Plusieurs indicateurs convergent rarement à ce niveau sur un même lot — notre analyse place cette pièce parmi les meilleures opportunités du moment.`;
  }
  return `Sélectionné pour la singularité de son rapport valeur/prix sur le marché actuel.`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: '10px', fontFamily: 'var(--font-mono)',
      letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'var(--text-3)', marginBottom: '20px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      {children}
      <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

function ExpiringRow({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  const urgent = lot.auction_date && hoursLeft(lot.auction_date) < 6;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '14px 0',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'opacity 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.72')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {/* Thumbnail */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '4px',
        overflow: 'hidden', flexShrink: 0,
        background: 'var(--bg-subtle)',
      }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '16px' }}>◇</div>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '14px',
          color: 'var(--navy)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.artist_name_raw || '—'}
        </div>
        <div style={{
          fontSize: '11px', color: 'var(--text-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px',
        }}>
          {lot.auction_house_name}
        </div>
      </div>

      {/* Countdown */}
      {lot.auction_date && (
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
            color: urgent ? 'var(--gold)' : 'var(--text-2)',
          }}>
            {urgent ? '⚡ ' : ''}{formatCountdown(lot.auction_date)}
          </div>
          {lot.deal_score !== null && lot.deal_score !== undefined && (
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
              score {lot.deal_score}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCard({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'opacity 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.78')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {/* Image */}
      <div style={{
        position: 'relative', paddingTop: '120%',
        background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden',
        marginBottom: '10px',
      }}>
        {lot.image_url
          ? <img
              src={lot.image_url} alt={lot.title || ''}
              loading="lazy"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '20px' }}>◇</div>
        }
        {lot.deal_score !== null && lot.deal_score !== undefined && (
          <div style={{
            position: 'absolute', top: '7px', right: '7px',
            background: 'rgba(26,42,68,0.82)', color: 'var(--gold)',
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            padding: '2px 6px', borderRadius: '3px',
          }}>
            {lot.deal_score}
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '13px', fontWeight: 500,
        color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {lot.artist_name_raw || '—'}
      </div>
      <div style={{
        fontSize: '11px', color: 'var(--text-3)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px',
      }}>
        {fmt(lot.current_price || lot.estimate_low)}
        {lot.auction_date && (
          <span style={{ marginLeft: '6px' }}>
            · {new Date(lot.auction_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/market-brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setBrief(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--text-3)',
          animation: 'todayFade 1.6s ease-in-out infinite',
        }}>
          Analyse en cours…
        </span>
        <style>{'@keyframes todayFade{0%,100%{opacity:0.2}50%{opacity:0.8}}'}</style>
      </div>
    );
  }

  if (!brief) {
    return (
      <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--navy)' }}>Indisponible pour le moment</div>
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Veuillez réessayer dans quelques instants.</div>
      </div>
    );
  }

  const expiringLots = brief.closing_soon.slice(0, isMobile ? 3 : 4);
  const conviction = brief.top_deal;

  return (
    <main style={{
      maxWidth: '860px', margin: '0 auto',
      padding: isMobile ? '32px 20px 80px' : '52px 24px 100px',
      background: 'transparent',
    }}>

      {/* ── ZONE 0 : Signal temporel ─────────────────────────────────── */}
      <div style={{ marginBottom: isMobile ? '40px' : '56px' }}>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--text-3)', marginBottom: '16px',
        }}>
          {formatDate(brief.generated_at)}
        </div>

        <div style={{
          fontSize: '12px', color: 'var(--text-3)',
          marginBottom: '14px', fontStyle: 'italic',
        }}>
          Depuis votre dernière visite :
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <StatLine
            value={brief.new_lots_count}
            label="nouvelles opportunités pertinentes"
            color="var(--navy)"
          />
          <StatLine
            value={brief.closing_today_count ?? brief.closing_soon.length}
            label="ventes se terminent aujourd'hui"
            color="var(--gold)"
          />
          <StatLine
            value={1}
            label="recommandation prioritaire"
            color="var(--electric)"
          />
        </div>
      </div>

      {/* ── ZONE 1 : Intro éditoriale ─────────────────────────────────── */}
      {conviction && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{
            fontFamily: 'var(--font-serif)', fontSize: '15px',
            fontStyle: 'italic', color: 'var(--text-2)',
            lineHeight: 1.6, margin: 0,
          }}>
            Si nous ne devions retenir qu'une seule opportunité aujourd'hui, ce serait celle-ci.
          </p>
        </div>
      )}

      {/* ── ZONE 2 : La Conviction du Jour ───────────────────────────── */}
      {conviction ? (
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '20px' : '48px',
            marginBottom: isMobile ? '48px' : '72px',
            alignItems: isMobile ? 'stretch' : 'flex-start',
          }}
        >
          {/* Image */}
          <div style={{
            flexShrink: 0,
            width: isMobile ? '100%' : '42%',
            height: isMobile ? '260px' : '480px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: 'var(--bg-subtle)',
            boxShadow: '0 2px 16px rgba(26,42,68,0.10)',
          }}>
            {conviction.image_url
              ? <img
                  src={conviction.image_url}
                  alt={`${conviction.artist_name_raw} — ${conviction.title}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '32px' }}>◇</div>
            }
          </div>

          {/* Texte éditorial */}
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            paddingTop: isMobile ? '0' : '24px',
          }}>

            {/* Eyebrow */}
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-3)', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              {conviction.auction_house_name && (
                <span>{conviction.auction_house_name}</span>
              )}
              {conviction.auction_date && hoursLeft(conviction.auction_date) > 0 && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: hoursLeft(conviction.auction_date) < 24 ? 'var(--gold)' : 'var(--text-3)' }}>
                    Clôture dans {formatCountdown(conviction.auction_date)}
                  </span>
                </>
              )}
            </div>

            {/* Artiste */}
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: isMobile ? '24px' : '30px',
              fontWeight: 400, color: 'var(--navy)',
              lineHeight: 1.15, marginBottom: '6px',
            }}>
              {conviction.artist_name_raw || '—'}
            </div>

            {/* Titre de l'œuvre */}
            {conviction.title && (
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '14px',
                color: 'var(--text-3)', marginBottom: '28px',
                fontStyle: 'italic',
              }}>
                {conviction.title}
              </div>
            )}

            {/* Phrase de conviction */}
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '15px',
              fontStyle: 'italic', color: 'var(--navy)',
              lineHeight: 1.65, marginBottom: '24px',
              opacity: 0.85,
              borderLeft: '2px solid var(--gold)',
              paddingLeft: '16px',
            }}>
              {buildConvictionPhrase(conviction)}
            </div>

            {/* Prix */}
            <div style={{ marginBottom: '28px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '18px',
                fontWeight: 600, color: 'var(--navy)',
              }}>
                {fmt(conviction.current_price || conviction.estimate_low)}
              </span>
              {conviction.estimate_low && conviction.estimate_high && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  color: 'var(--text-3)', marginLeft: '10px',
                }}>
                  est. {fmt(conviction.estimate_low)} – {fmt(conviction.estimate_high)}
                </span>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate(`/app/opportunities/${conviction.id}`)}
              style={{
                alignSelf: 'flex-start',
                padding: '11px 26px',
                background: 'var(--navy)', color: '#fff',
                border: 'none', borderRadius: '6px',
                fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', letterSpacing: '0.03em',
                fontFamily: 'var(--font-sans)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Voir l'opportunité →
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '64px 20px',
          color: 'var(--text-3)', fontSize: '13px',
          fontStyle: 'italic', marginBottom: '72px',
        }}>
          Aucune recommandation disponible pour le moment.
        </div>
      )}

      {/* ── ZONE 3 : Ce qui expire ────────────────────────────────────── */}
      {expiringLots.length > 0 && (
        <div style={{ marginBottom: isMobile ? '48px' : '64px' }}>
          <SectionLabel>Ce qui expire</SectionLabel>
          <div>
            {expiringLots.map(lot => (
              <ExpiringRow
                key={lot.id}
                lot={lot}
                onClick={() => navigate(`/app/opportunities/${lot.id}`)}
              />
            ))}
            {brief.closing_soon.length > expiringLots.length && (
              <button
                onClick={() => navigate('/app/urgent')}
                style={{
                  marginTop: '14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: '12px', color: 'var(--electric)',
                  fontWeight: 600, padding: 0, fontFamily: 'var(--font-sans)',
                }}
              >
                Voir toutes les ventes imminentes →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ZONE 4 : Nouveau depuis votre dernière visite ─────────────── */}
      {brief.new_lots.length > 0 && (
        <div style={{ marginBottom: isMobile ? '48px' : '64px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline',
            justifyContent: 'space-between', marginBottom: '20px',
          }}>
            <div style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              Nouveau depuis votre dernière visite
              <span style={{ flex: 1, height: '1px', background: 'var(--border)', display: 'inline-block', width: '40px' }} />
            </div>
            {brief.new_lots_count > brief.new_lots.length && (
              <button
                onClick={() => navigate('/app/explore')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '11px', color: 'var(--electric)', fontWeight: 600,
                  padding: 0, flexShrink: 0, fontFamily: 'var(--font-sans)',
                }}
              >
                {brief.new_lots_count} au total →
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: isMobile ? '16px' : '20px',
          }}>
            {brief.new_lots.map(lot => (
              <MiniCard
                key={lot.id}
                lot={lot}
                onClick={() => navigate(`/app/opportunities/${lot.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── ZONE 5 : Agent unread CTA ─────────────────────────────────── */}
      {brief.agent_unread > 0 && (
        <div
          onClick={() => navigate('/app/agent')}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '18px 24px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background 0.12s',
            background: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: '13px',
          }}>
            ◆
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)', marginBottom: '2px' }}>
              {brief.agent_unread} alerte{brief.agent_unread > 1 ? 's' : ''} de l'agent vous attendent
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Votre agent a analysé de nouvelles opportunités depuis votre dernière visite →
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

// ─── StatLine ─────────────────────────────────────────────────────────────────

function StatLine({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700,
        color, minWidth: '40px', textAlign: 'right', lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>
        {label}
      </span>
    </div>
  );
}
