import { useEffect } from 'react';
import { getResolvedOrigin, SITE_CONFIG } from '@/src/config/site';

interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function upsertMeta(selector: string, attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function SeoHead({ title, description, path, noindex = false, structuredData }: SeoHeadProps) {
  useEffect(() => {
    const origin = getResolvedOrigin();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const canonicalUrl = origin
      ? `${origin}${normalizedPath === '/' ? '/' : normalizedPath}`
      : '';

    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    if (canonicalUrl) {
      upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    }
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_CONFIG.name);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    if (SITE_CONFIG.gscVerification) {
      upsertMeta(
        'meta[name="google-site-verification"]',
        'name',
        'google-site-verification',
        SITE_CONFIG.gscVerification,
      );
    }

    if (noindex) {
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, follow');
    } else {
      const existingRobots = document.head.querySelector('meta[name="robots"]');
      if (existingRobots) existingRobots.remove();
    }

    const existingCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!noindex && canonicalUrl) {
      if (existingCanonical) {
        existingCanonical.setAttribute('href', canonicalUrl);
      } else {
        const canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        canonical.setAttribute('href', canonicalUrl);
        document.head.appendChild(canonical);
      }
    } else if (existingCanonical) {
      existingCanonical.remove();
    }

    const existingSchemas = document.head.querySelectorAll('script[data-toolmitra-jsonld="true"]');
    existingSchemas.forEach((node) => node.remove());

    if (structuredData) {
      const items = Array.isArray(structuredData) ? structuredData : [structuredData];
      items.forEach((item) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-toolmitra-jsonld', 'true');
        script.textContent = JSON.stringify(item);
        document.head.appendChild(script);
      });
    }
  }, [title, description, path, noindex, structuredData]);

  return null;
}
