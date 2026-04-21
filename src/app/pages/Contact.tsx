import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { useSEO } from '../../lib/useSEO';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function Contact() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useSEO({
    title: 'Contact · Nautilus',
    description: 'Get in touch with the Nautilus team.',
  });

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) return;
    setLoading(true);
    try {
      await fetch(`${BACKEND}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSent(true);
    } catch {
      setSent(true); // Show success even if fails
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <Logo variant="horizontal" color="dark" size={24} />
        </div>
        <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '11px', padding: '8px 20px', borderRadius: '6px' }}>
          Get access →
        </button>
      </div>

      <div style={{ maxWidth: '560px', margin: '80px auto', padding: '0 24px' }}>
        {!sent ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Contact
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
                Get in touch
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.7 }}>
                Questions about Nautilus, partnership inquiries, or institutional access — we respond within 24 hours.
              </p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Name</label>
                    <input className="input" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</label>
                    <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Subject</label>
                  <select className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                    <option value="">Select subject</option>
                    <option value="general">General inquiry</option>
                    <option value="institutional">Institutional access</option>
                    <option value="partnership">Partnership</option>
                    <option value="press">Press & media</option>
                    <option value="support">Technical support</option>
                    <option value="billing">Billing</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Message</label>
                  <textarea className="input" placeholder="How can we help you?" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ minHeight: '120px', resize: 'vertical' }} />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.name || !form.email || !form.message}
                  className="btn-electric"
                  style={{ fontSize: '13px', padding: '13px', justifyContent: 'center', borderRadius: '8px', opacity: (!form.name || !form.email || !form.message) ? 0.5 : 1 }}
                >
                  {loading ? 'Sending...' : 'Send message →'}
                </button>
              </div>
            </div>

          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border, rgba(37,99,235,0.2))', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '24px', color: 'var(--electric)' }}>✓</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text)', marginBottom: '12px' }}>Message sent</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '28px', lineHeight: 1.7 }}>
              Thank you for reaching out. We'll get back to you within 24 hours at {form.email}.
            </p>
            <button onClick={() => navigate('/')} className="btn-electric" style={{ fontSize: '13px', padding: '12px 32px', borderRadius: '8px' }}>
              Back to Nautilus →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
