export const SITE_CONFIG = {
  name: 'ToolMitra',
  tagline: 'Free Online Tools for Everyday Work',
  description:
    'Fast, private browser-based tools for everyday work. Compress images, convert JPG to PDF, generate QR codes, count words, and calculate exact age.',
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '') || '',
  contactEmail: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || '',
  contactLocation:
    (import.meta.env.VITE_CONTACT_LOCATION as string | undefined)?.trim() ||
    'Digital Utility Platform',
  gaMeasurementId: (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() || '',
  adsenseClientId: (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined)?.trim() || '',
  gscVerification: (import.meta.env.VITE_GSC_VERIFICATION as string | undefined)?.trim() || '',
} as const;

export function getResolvedOrigin(): string {
  if (SITE_CONFIG.siteUrl && /^https?:\/\//i.test(SITE_CONFIG.siteUrl)) {
    return SITE_CONFIG.siteUrl;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}
