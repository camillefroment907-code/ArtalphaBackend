interface OpportunityCardProps {
  id: string;
  imageUrl: string;
  artistName: string;
  title: string;
  price: string;
  estimatedValue: string;
  upside: string;
  score: number;
  onClick: () => void;
  // Investment signals (optional — shown on alpha tab)
  upsidePercent?: number;
  auctionDate?: string;
  rawPrice?: number;
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`score-dot ${i < score ? 'filled' : 'unfilled'}`} />
      ))}
    </div>
  );
}

export function OpportunityCard({
  imageUrl,
  artistName,
  title,
  price,
  estimatedValue,
  upside,
  score,
  onClick,
  upsidePercent = 0,
  auctionDate,
  rawPrice = 0,
}: OpportunityCardProps) {
  const showSignals = upsidePercent > 5 || score >= 3;

  return (
    <div className="artwork-card" style={{ width: '100%' }} onClick={onClick}>
      {/* Image */}
      <div style={{ position: 'relative', paddingTop: '130%', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        <img
          src={imageUrl || ''}
          alt={`${artistName} — ${title}`}
          className="artwork-image"
          loading="lazy"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
          }}
        />

        {/* Hover overlay */}
        <div
          className="artwork-info-overlay"
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(26,42,68,0.88) 0%, rgba(26,42,68,0.3) 50%, transparent 100%)',
            opacity: 0, transition: 'opacity 0.3s var(--ease)',
            display: 'flex', alignItems: 'flex-end', padding: '20px',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--gold)', marginBottom: '4px' }}>
              {artistName}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{title}</div>
          </div>
        </div>

        {/* Upside badge — top right */}
        {upside && upside !== '0%' && (
          <div style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(26,42,68,0.85)', color: 'var(--gold)',
            fontSize: '11px', fontWeight: 700,
            padding: '3px 9px', borderRadius: '4px', backdropFilter: 'blur(4px)',
          }}>
            +{upside}
          </div>
        )}

        {/* Auction date badge — bottom left */}
        {auctionDate && (
          <div style={{
            position: 'absolute', bottom: '8px', left: '10px',
            background: 'rgba(26,42,68,0.75)', color: 'rgba(255,255,255,0.9)',
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
            padding: '2px 7px', borderRadius: '3px', backdropFilter: 'blur(4px)',
          }}>
            {new Date(auctionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '16px', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 500,
              color: 'var(--navy)', marginBottom: '2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {artistName}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa' }}>Score</span>
            <ScoreDots score={score} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
            {price}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            est. {estimatedValue}
          </span>
        </div>

        {/* Investment signals row */}
        {showSignals && (
          <div style={{
            marginTop: '10px', paddingTop: '10px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
          }}>
            {upsidePercent > 5 && (
              <span style={{
                fontSize: '10px', fontWeight: 700,
                color: 'var(--navy)',
                background: 'rgba(26,42,68,0.07)',
                padding: '2px 7px', borderRadius: '3px',
              }}>
                +{upsidePercent}% vs est.
              </span>
            )}
            {rawPrice > 0 && score >= 3 && (
              <span style={{
                fontSize: '10px', fontWeight: 600,
                color: 'var(--gold)', fontFamily: 'var(--font-mono)',
              }}>
                ×{(Math.pow(1.08, 10)).toFixed(1)} in 10yr
              </span>
            )}
            {score >= 4 && (
              <span style={{
                fontSize: '9px', fontWeight: 700,
                color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                ◆ Strong deal
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
