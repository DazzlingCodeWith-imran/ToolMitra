import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_CONFIG } from '@/src/config/site';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Environment-gated loader for Google Analytics 4 and Google AdSense.
 * Injects nothing unless valid IDs are configured via environment variables.
 */
export function AnalyticsLoader() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const gaId = SITE_CONFIG.gaMeasurementId;
    if (gaId && /^G-[A-Z0-9]+$/i.test(gaId)) {
      if (!document.querySelector(`script[data-toolmitra-ga="${gaId}"]`)) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
        script.setAttribute('data-toolmitra-ga', gaId);
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag(...args: unknown[]) {
          window.dataLayer?.push(args);
        };
        window.gtag('js', new Date());
        window.gtag('config', gaId, { send_page_view: false });
      }

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
          page_path: `${pathname}${search}`,
        });
      }
    }
  }, [pathname, search]);

  useEffect(() => {
    const adsenseId = SITE_CONFIG.adsenseClientId;
    if (adsenseId && /^ca-pub-\d+$/.test(adsenseId)) {
      if (!document.querySelector(`script[data-toolmitra-adsense="${adsenseId}"]`)) {
        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
          adsenseId,
        )}`;
        script.setAttribute('data-toolmitra-adsense', adsenseId);
        document.head.appendChild(script);
      }
    }
  }, []);

  return null;
}
