interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,42,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', padding: 40, maxWidth: 420, width: '100%', textAlign: 'center', borderTop: '3px solid #C6A85A' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ color: '#C6A85A', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
          INVESTOR FEATURE
        </div>
        <div style={{ color: '#1A2A44', fontFamily: 'Georgia, serif', fontSize: 22, marginBottom: 12 }}>
          Unlock this opportunity
        </div>
        <div style={{ color: '#888', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          See the auction source, bidding link, and fair value.<br />
          Get early access before the market reacts.
        </div>
        <a
          href="/app/pricing"
          style={{ display: 'block', background: '#2563EB', color: '#fff', padding: '14px 32px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textDecoration: 'none' }}
        >
          Get founding access — €19/month →
        </a>
        <div style={{ marginTop: 12, color: '#C6A85A', fontSize: 11 }}>
          Founding price · Increases to €99 at launch
        </div>
      </div>
    </div>
  );
}
