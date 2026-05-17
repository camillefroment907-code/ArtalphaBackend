import { useSEO } from '../../lib/useSEO';

export default function Partners() {
  useSEO({
    title: 'Partners · Nautilus',
    description: 'Partner with Nautilus to deliver art market intelligence to your clients. Contact us at partners@get-nautilus.com.',
  });
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 36, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 16px' }}>
          Partners
        </h1>
        <p style={{ fontSize: 16, color: '#6B6560', lineHeight: 1.7 }}>
          Interested in partnering with Nautilus? Reach out at{' '}
          <a href="mailto:partners@get-nautilus.com" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>
            partners@get-nautilus.com
          </a>
        </p>
      </div>
    </div>
  );
}
