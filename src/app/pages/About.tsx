import { dailyLots } from '../../lib/dailyStats';

export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
            <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="2" fill="#C6A85A"/>
          </svg>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 600, color: 'var(--navy)', letterSpacing: '0.06em' }}>Nautilus</span>
        </a>
        <a href="/app/signup" style={{ background: 'var(--electric)', color: 'white', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em' }}>
          GET ACCESS
        </a>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--navy)', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: '#C6A85A', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
            OUR MISSION
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, color: 'white', lineHeight: 1.2, marginBottom: '20px' }}>
            We built the Bloomberg terminal<br />for art investment.
          </h1>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, maxWidth: '560px', margin: '0 auto' }}>
            The art market has always been opaque by design. Galleries, auction houses, and dealers have held the data advantage for decades. Nautilus changes that.
          </p>
        </div>
      </div>

      {/* Story */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '80px 40px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: 'var(--text)', marginBottom: '20px' }}>The problem we're solving</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.9, marginBottom: '20px' }}>
          Every week, hundreds of artworks sell 20–50% below their real market value at auction. Not because they're inferior works — but because most buyers lack the data infrastructure to identify the gap before the hammer falls.
        </p>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.9, marginBottom: '20px' }}>
          The information exists. Comparable sales, artist momentum, gallery tier, institutional demand signals — it's all there. Scattered across 200+ auction catalogues, primary market platforms, and private databases. Nautilus aggregates it, scores it, and surfaces it in real time.
        </p>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.9, marginBottom: '48px' }}>
          We built Nautilus for the collector who thinks like an investor. For the family office that wants to add art to its alternative asset allocation. For the first-time buyer who refuses to overpay.
        </p>

        {/* Values */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '64px' }}>
          {[
            { icon: '◆', title: 'Data over intuition', body: 'Every recommendation is backed by comparable sales data, not gallery relationships or market hype.' },
            { icon: '◎', title: 'Transparency', body: 'We show our work. Every score comes with a rationale explaining exactly why an opportunity ranks.' },
            { icon: '◐', title: 'Alignment', body: 'We succeed when you find profitable opportunities. Our model is subscription-based — never commission.' },
          ].map(({ icon, title, body }) => (
            <div key={title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px' }}>
              <div style={{ fontSize: '18px', color: '#C6A85A', marginBottom: '12px' }}>{icon}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{title}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ background: 'var(--navy)', borderRadius: '12px', padding: '40px', marginBottom: '64px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', textAlign: 'center' }}>
            {[
              { value: `${dailyLots().toLocaleString()}+`, label: 'Lots tracked weekly' },
              { value: '10+', label: 'Auction houses' },
              { value: '73%', label: 'Signal accuracy' },
              { value: '200+', label: 'Active members' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: '#C6A85A', marginBottom: '6px' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: 'var(--text)', marginBottom: '12px' }}>
            Ready to invest with an edge?
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '24px' }}>
            Join collectors and investors who use Nautilus to find opportunities before the market corrects.
          </p>
          <a href="/app/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--electric)', color: 'white', padding: '13px 32px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
            Get access — Free →
          </a>
        </div>
      </div>
    </div>
  );
}
