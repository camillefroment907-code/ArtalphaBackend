import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  noindex?: boolean;
}

const DEFAULT_DESCRIPTION = 'Nautilus scans 500,000+ auction lots across 30+ sources and scores every opportunity with AI. Find undervalued art before the market corrects.';
const DEFAULT_IMAGE = 'https://get-nautilus.com/og-image.png';
const BASE_TITLE = 'Nautilus';

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

export function useSEO({ title, description, image, noindex }: SEOProps) {
  useEffect(() => {
    const fullTitle = title === BASE_TITLE ? title : `${title} — ${BASE_TITLE}`;
    const desc = description || DEFAULT_DESCRIPTION;
    const img = image || DEFAULT_IMAGE;
    const canonical = window.location.href;

    // Title
    document.title = fullTitle;

    // Meta
    setMeta('description', desc);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // OG
    setOG('og:title', fullTitle);
    setOG('og:description', desc);
    setOG('og:image', img);
    setOG('og:url', canonical);

    // Twitter
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }, [title, description, image, noindex]);
}
