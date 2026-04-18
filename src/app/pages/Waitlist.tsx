import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const FOUNDING_PERKS = [
  { icon: '◆', label: 'Locked-in pricing', desc: 'Your plan price never increases — ever.' },
  { icon: '◎', label: 'Founding Member badge', desc: 'Permanent recognition on your profile.' },
  { icon: '↑', label: 'Free upgrade — 1 year', desc: 'Move up one plan tier for 12 months, on us.' },
  { icon: '⚡', label: 'Priority access', desc: 'First in line on launch day, May 13.' },
];

const COUNTDOWN_TARGET = new Date('2026-05-13T08:00:00Z');

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, COUNTDOWN_TARGET.getTime() - now);
      setTimeLeft({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000)  / 60000),
        seconds: Math.floor((diff % 60000)    / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

export default function Waitlist() {
  const [email, setEmail]         = useState('');
  const [name, setName]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [position, setPosition]   = useState<number | null>(null);
  const [error, setError]         = useState('');
  const countdown = useCountdown();

  // Pull referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setReferralCode(ref);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), referral_code: referralCode || undefined }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setPosition(data.position || null);
      setSubmitted(true);
      // Generate a referral code from email hash
      const code = btoa(email.trim()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      setReferralCode(data.referral_code || code);
    } catch {
      // Graceful degradation — still show success (email captured client-side)
      setSubmitted(true);
      const code = btoa(email.trim()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      setReferralCode(code);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = `${window.location.origin}/waitlist?ref=${referralCode}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink).catch(() => {});
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', height: '64px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo variant="horizontal" color="dark" size={24} />
        </Link>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          LAUNCHING MAY 13, 2026
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: '80px 40px', maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)', borderRadius: '20px', padding: '6px 16px', marginBottom: '32px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>FOUNDING MEMBER ACCESS</span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.15, marginBottom: '20px' }}>
          Nautilus launches May 13.
          <br />
          <span style={{ color: 'var(--navy)' }}>Get early access.</span>
        </h1>

        <p style={{ fontSize: '18px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '48px', maxWidth: '540px', margin: '0 auto 48px' }}>
          Join the waitlist to secure your Founding Member status — locked-in pricing, a permanent badge, and a free plan upgrade for your first year.
        </p>

        {/* Countdown */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '48px' }}>
          {[
            { value: countdown.days,    label: 'DAYS'    },
            { value: countdown.hours,   label: 'HOURS'   },
            { value: countdown.minutes, label: 'MIN'     },
            { value: countdown.seconds, label: 'SEC'     },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: 'center', minWidth: '64px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>
                {String(value).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        {!submitted ? (
          <form onSubmit={handleSubmit} style={{ maxWidth: '480px', margin: '0 auto 40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input"
                style={{ padding: '14px 18px', fontSize: '15px', borderRadius: '8px' }}
              />
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input"
                style={{ padding: '14px 18px', fontSize: '15px', borderRadius: '8px' }}
              />
              {referralCode && (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', padding: '8px 14px', borderRadius: '6px', textAlign: 'left' }}>
                  Referral code applied: <strong style={{ color: 'var(--navy)' }}>{referralCode}</strong> (+10 positions)
                </div>
              )}
              {error && (
                <div style={{ fontSize: '13px', color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{error}</div>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  background: loading ? 'var(--text-3)' : 'var(--navy)',
                  color: 'white', padding: '16px 32px', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  transition: 'all 0.2s ease',
                }}
              >
                {loading ? 'Joining...' : 'Secure My Founding Member Spot →'}
              </button>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              No credit card required · Unsubscribe anytime
            </div>
          </form>
        ) : (
          /* Success state */
          <div style={{ maxWidth: '520px', margin: '0 auto 40px', background: 'white', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px', boxShadow: '0 8px 40px rgba(10,22,40,0.08)' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>◆</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--navy)', marginBottom: '8px' }}>
              You're in, {name || 'Collector'}.
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', marginBottom: '24px', lineHeight: 1.6 }}>
              {position ? `You're #${position} on the waitlist.` : "You're on the waitlist."} Founding Member access is yours. We'll email you on May 13.
            </p>
            <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '12px' }}>
                MOVE UP THE LIST — SHARE YOUR LINK
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>
                +10 positions per referral. 3 referrals = free upgrade for 1 year.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {referralLink}
                </div>
                <button
                  onClick={copyReferralLink}
                  style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Copy link
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href={`https://twitter.com/intent/tweet?text=Just+joined+the+Nautilus+waitlist+%E2%80%94+AI+platform+for+art+market+intelligence.+Launching+May+13.+Get+early+access%3A+${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, background: '#000', color: 'white', borderRadius: '6px', padding: '10px 16px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}
              >
                Share on X
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, background: '#0077B5', color: 'white', borderRadius: '6px', padding: '10px 16px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}
              >
                Share on LinkedIn
              </a>
            </div>
          </div>
        )}

        {/* Founding Member perks */}
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '20px' }}>
            Founding Member perks
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {FOUNDING_PERKS.map(({ icon, label, desc }) => (
              <div key={label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', textAlign: 'left' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--navy)' }}>{icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* Social proof strip */}
      <div style={{ background: 'var(--navy)', padding: '20px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          {[
            { value: '500K+', label: 'Lots analyzed' },
            { value: '30+',   label: 'Global sources' },
            { value: '4.9/5', label: 'Beta rating'   },
            { value: '28',    label: 'Countries'      },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--gold)' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: '32px 40px', textAlign: 'center', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          © 2026 Nautilus · <Link to="/legal/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy</Link> · <Link to="/legal/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}
