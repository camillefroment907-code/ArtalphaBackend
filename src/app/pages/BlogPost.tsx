/**
 * /blog/:slug — Individual blog post.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSEO } from '../../lib/useSEO';
import { Logo } from '../components/Logo';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang: 'fr' | 'en' = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const [post, setPost]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const localize = (field: any): string => {
    if (!field) return '';
    if (typeof field !== 'string') return String(field);
    try {
      const parsed = JSON.parse(field);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed[lang] || parsed['en'] || parsed['fr'] || field;
      }
    } catch {}
    return field;
  };

  useSEO({
    title: post ? `${localize(post.title)} · Nautilus` : 'Art Market Intelligence · Nautilus',
    description: post ? localize(post.excerpt) : 'Art market analysis and investment signals from Nautilus.',
    image: post?.cover_image || undefined,
    ogType: 'article',
    schema: post ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: localize(post.title),
      description: localize(post.excerpt),
      image: post.cover_image,
      author: { '@type': 'Person', name: post.author },
      datePublished: post.published_at,
      publisher: {
        '@type': 'Organization',
        name: 'Nautilus',
        url: 'https://get-nautilus.com',
      },
    } : undefined,
  });

  useEffect(() => {
    if (!slug) return;
    fetch(`${BACKEND}/api/blog/${slug}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setPost)
      .catch(() => setError('Post not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', height: '64px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo variant="horizontal" color="dark" size={24} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Language toggle */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-subtle)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
            {(['fr', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => { i18n.changeLanguage(l); localStorage.setItem('i18nextLng', l); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  background: lang === l ? 'var(--navy)' : 'transparent',
                  color: lang === l ? 'white' : 'var(--text-3)',
                  transition: 'all 0.15s',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <Link to="/blog" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>← All articles</Link>
        </div>
      </header>

      {loading && (
        <div style={{ maxWidth: '720px', margin: '64px auto', padding: '0 40px' }}>
          <div className="skeleton" style={{ height: '40px', marginBottom: '16px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '20px', width: '60%', marginBottom: '32px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ height: '300px', borderRadius: '8px' }} />
        </div>
      )}

      {error && (
        <div style={{ maxWidth: '720px', margin: '80px auto', padding: '0 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>◆</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text)', marginBottom: '12px' }}>Article not found</h1>
          <Link to="/blog" style={{ color: 'var(--navy)', fontWeight: 600 }}>← Back to the blog</Link>
        </div>
      )}

      {post && (
        <article style={{ maxWidth: '720px', margin: '0 auto', padding: '56px 40px 80px' }}>
          {/* Meta */}
          {post.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {post.tags.map((tag: string) => (
                <span key={tag} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold-dim)', background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 700, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.25 }}>
            {localize(post.title)}
          </h1>

          {post.excerpt && (
            <p style={{ fontSize: '17px', color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.7, borderLeft: '3px solid var(--gold)', paddingLeft: '16px' }}>
              {localize(post.excerpt)}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: 700 }}>
              N
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{post.author}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(post.published_at)} · {post.read_time_minutes} min read</div>
            </div>
          </div>

          {post.cover_image && (
            <div style={{ margin: '0 0 32px', borderRadius: '8px', overflow: 'hidden' }}>
              <img src={post.cover_image} alt="" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {/* Content */}
          <div
            style={{ fontSize: '16px', color: 'var(--text)', lineHeight: 1.85, fontFamily: 'var(--font-sans)' }}
            dangerouslySetInnerHTML={{ __html: localize(post.content)
              .replace(/^# (.+)$/gm, '<h1 style="font-family:var(--font-serif);font-size:28px;font-weight:700;margin:40px 0 16px">$1</h1>')
              .replace(/^## (.+)$/gm, '<h2 style="font-family:var(--font-serif);font-size:22px;font-weight:600;margin:32px 0 12px">$1</h2>')
              .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:600;margin:24px 0 10px">$1</h3>')
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>')
              .replace(/\n\n/g, '</p><p style="margin:0 0 18px">')
              .replace(/^/, '<p style="margin:0 0 18px">') + '</p>'
            }}
          />

          {/* CTA */}
          <div style={{ marginTop: '56px', padding: '32px', background: 'var(--navy)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '12px' }}>ACCESS THE FULL PLATFORM</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'white', marginBottom: '8px' }}>See these signals live in Nautilus</div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '20px' }}>500,000+ lots analyzed · AI-powered deal scoring · Real-time alerts</p>
            <Link to="/app/signup" style={{ display: 'inline-block', background: 'var(--gold)', color: 'var(--navy)', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
              Start free →
            </Link>
          </div>
        </article>
      )}

      <footer style={{ padding: '32px 40px', textAlign: 'center', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          © 2026 Nautilus · <Link to="/legal/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy</Link> · <Link to="/legal/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}
