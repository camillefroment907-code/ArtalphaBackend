/**
 * CookieBanner — GDPR-compliant consent banner.
 * Shown once per browser. Consent stored in localStorage 'nautilus_cookie_consent'.
 * Values: "all" | "necessary"
 */
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'nautilus_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      // Small delay so page renders first
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    } else if (existing === 'all') {
      // Returning user who already gave consent — load analytics immediately
      _loadAnalytics();
    }
  }, []);

  const accept = (choice: 'all' | 'necessary') => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    // If accepted all, load analytics scripts
    if (choice === 'all') {
      _loadAnalytics();
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed', bottom: '24px', left: '24px',
        zIndex: 9999,
        background: 'var(--bg-card, #FFFFFF)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 16px 64px rgba(10,22,40,0.18)',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)',
        padding: '24px',
        animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-start' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'var(--navy-subtle, rgba(10,22,40,0.06))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', flexShrink: 0,
        }}>🍪</div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
            We use cookies
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
            Nautilus uses cookies to improve your experience and analyse usage.
            By clicking "Accept all", you consent to our use of analytics cookies.
          </p>
        </div>
      </div>

      {showDetails && (
        <div style={{
          background: 'var(--bg-subtle)', borderRadius: '8px',
          padding: '14px', marginBottom: '16px', fontSize: '11px',
          color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>Cookie categories:</div>
          <div style={{ marginBottom: '4px' }}>
            <strong>Necessary</strong> — Authentication, security, session management. Always active.
          </div>
          <div>
            <strong>Analytics</strong> — Microsoft Clarity, Google Analytics 4. Helps us understand how Nautilus is used. Off by default.
          </div>
          <a
            href="/legal/privacy"
            style={{ color: 'var(--navy)', fontSize: '11px', display: 'block', marginTop: '8px' }}
          >
            Privacy Policy →
          </a>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => accept('all')}
          style={{
            flex: 1, padding: '10px 16px',
            background: 'var(--navy, #0A1628)', color: 'white',
            border: 'none', borderRadius: '8px',
            fontSize: '12px', fontWeight: 700,
            cursor: 'pointer', minHeight: '40px',
            letterSpacing: '0.04em',
          }}
        >
          Accept all
        </button>
        <button
          onClick={() => accept('necessary')}
          style={{
            flex: 1, padding: '10px 16px',
            background: 'transparent', color: 'var(--text-2)',
            border: '1px solid var(--border)', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', minHeight: '40px',
          }}
        >
          Necessary only
        </button>
      </div>

      <button
        onClick={() => setShowDetails(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '11px', color: 'var(--text-3)',
          marginTop: '10px', padding: '0',
          textDecoration: 'underline', display: 'block',
        }}
      >
        {showDetails ? 'Hide details' : 'Cookie details'}
      </button>
    </div>
  );
}

function _loadAnalytics() {
  if (typeof window === 'undefined') return;

  // Microsoft Clarity — inject dynamically after consent
  if (!(window as any).__clarityLoaded) {
    const clarityId = (import.meta as any).env?.VITE_CLARITY_ID;
    if (clarityId) {
      (window as any).__clarityLoaded = true;
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.async = true;
      s.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${clarityId}");`;
      document.head.appendChild(s);
    }
  }

  // Google Analytics 4 — inject dynamically after consent
  if (!(window as any).__ga4Loaded) {
    const ga4Id = (import.meta as any).env?.VITE_GA4_ID;
    if (ga4Id) {
      (window as any).__ga4Loaded = true;
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag = function () { (window as any).dataLayer.push(arguments); };
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', ga4Id, { send_page_view: false });
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
      document.head.appendChild(s);
    }
  }
}
