import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  schema?: object; // JSON-LD structured data
}

const DEFAULT_DESCRIPTION = 'Nautilus scans 500,000+ auction lots across 30+ sources and scores every opportunity with AI. Find undervalued art before the market corrects.';
const DEFAULT_IMAGE = 'https://get-nautilus.com/og-image.png';
const BASE_TITLE = 'Nautilus';
const SITE_URL = 'https://get-nautilus.com';

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOG(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setJsonLd(schema: object) {
  const id = 'nautilus-jsonld';
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(schema);
}

function removeJsonLd() {
  document.getElementById('nautilus-jsonld')?.remove();
}

export function useSEO({ title, description, image, noindex, ogType = 'website', schema }: SEOProps) {
  useEffect(() => {
    const fullTitle = title === BASE_TITLE ? title : `${title} — ${BASE_TITLE}`;
    const desc = description || DEFAULT_DESCRIPTION;
    const img = image || DEFAULT_IMAGE;
    // Canonical: use clean pathname only (no query strings)
    const canonical = `${SITE_URL}${window.location.pathname}`;

    // Title
    document.title = fullTitle;

    // Meta
    setMeta('description', desc);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    setOG('og:title', fullTitle);
    setOG('og:description', desc);
    setOG('og:image', img);
    setOG('og:url', canonical);
    setOG('og:type', ogType);
    setOG('og:site_name', BASE_TITLE);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    // JSON-LD
    if (schema) {
      setJsonLd(schema);
    } else {
      removeJsonLd();
    }
  }, [title, description, image, noindex, ogType, schema]);
}
