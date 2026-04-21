/**
 * /blog — Nautilus market intelligence blog.
 * Lists all published posts.
 */
import { useState, useEffect } from 'react';
import { useSEO } from '../../lib/useSEO';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string;
  tags: string[];
  published_at: string | null;
  read_time_minutes: number;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', transition: 'box-shadow 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,22,40,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        {post.cover_image && (
          <div style={{ height: '180px', overflow: 'hidden' }}>
            <img src={post.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ padding: '20px 22px' }}>
          {post.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {post.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold-dim)', background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.35 }}>
            {post.title}
          </h2>
          {post.excerpt && (
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {post.excerpt}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(post.published_at)}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>·</span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{post.read_time_minutes} min read</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function Blog() {
  const [posts, setPosts]   = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]   = useState(0);

  useSEO({
    title: 'The Nautilus Brief · Art Market Intelligence',
    description: 'Art market analysis, investment signals, and collector intelligence — updated weekly.',
  });

  useEffect(() => {
    fetch(`${BACKEND}/api/blog?per_page=12`)
      .then(r => r.json())
      .then(data => {
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', height: '64px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo variant="horizontal" color="dark" size={24} />
        </Link>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link to="/app/login" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>Sign in</Link>
          <Link to="/app/signup" style={{ fontSize: '13px', color: 'white', background: 'var(--navy)', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>Get access</Link>
        </div>
      </header>

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '64px 40px' }}>
        {/* Page header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>
            MARKET INTELLIGENCE
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
            The Nautilus Brief
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', lineHeight: 1.6, maxWidth: '560px' }}>
            Art market analysis, investment signals, and collector intelligence — updated weekly.
          </p>
        </div>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '280px', borderRadius: '10px' }} />
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>◆</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>Market intelligence briefs coming soon</div>
            <p style={{ fontSize: '14px' }}>Weekly analysis, collector insights, and market intelligence from Nautilus.</p>
            <Link to="/app/signup" style={{ display: 'inline-block', marginTop: '20px', background: 'var(--navy)', color: 'white', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
              Start free →
            </Link>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <>
            {/* Featured first post */}
            {posts[0] && (
              <Link to={`/blog/${posts[0].slug}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '32px' }}>
                <article style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'grid', gridTemplateColumns: posts[0].cover_image ? '1fr 1fr' : '1fr', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(10,22,40,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {posts[0].cover_image && (
                    <div style={{ height: '320px', overflow: 'hidden' }}>
                      <img src={posts[0].cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>✦ FEATURED</div>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.3 }}>{posts[0].title}</h2>
                    {posts[0].excerpt && <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.7 }}>{posts[0].excerpt}</p>}
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(posts[0].published_at)} · {posts[0].read_time_minutes} min read</div>
                  </div>
                </article>
              </Link>
            )}

            {/* Grid of remaining posts */}
            {posts.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {posts.slice(1).map(post => <PostCard key={post.id} post={post} />)}
              </div>
            )}
          </>
        )}
      </div>

      <footer style={{ padding: '32px 40px', textAlign: 'center', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          © 2026 Nautilus · <Link to="/legal/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy</Link> · <Link to="/legal/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}
