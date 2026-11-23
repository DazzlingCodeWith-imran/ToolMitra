import { SITE_CONFIG } from '@/src/config/site';
import { TOOLS } from '@/src/data/tools';

export interface PrerenderRouteMeta {
  path: string;
  title: string;
  description: string;
  changefreq: 'weekly' | 'monthly';
  priority: string;
  noindex?: boolean;
  structuredData?: (origin: string) => Array<Record<string, unknown>>;
}

const STATIC_ROUTES: PrerenderRouteMeta[] = [
  {
    path: '/',
    title: 'ToolMitra – Free Online Tools for Everyday Work',
    description: SITE_CONFIG.description,
    changefreq: 'weekly',
    priority: '1.0',
    structuredData: (origin) => [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_CONFIG.name,
        description: SITE_CONFIG.description,
        ...(origin ? { url: origin } : {}),
      },
    ],
  },
  {
    path: '/tools',
    title: 'All Free Online Tools – ToolMitra Directory',
    description:
      "Browse ToolMitra's collection of free, browser-based tools for images, PDFs, QR codes, writing, and date calculations with no signup required.",
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/about',
    title: 'About Us – How ToolMitra Works | ToolMitra',
    description:
      'Learn how ToolMitra provides fast, privacy-first online tools that run directly inside your browser without uploading files or requiring accounts.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/contact',
    title: 'Contact Us – Feedback & Bug Reports | ToolMitra',
    description:
      'Contact ToolMitra with bug reports, feature requests, or general questions about our free browser-based utilities.',
    changefreq: 'monthly',
    priority: '0.5',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy – Local Processing & Data Practices | ToolMitra',
    description:
      "Read ToolMitra's Privacy Policy explaining client-side browser processing, local theme storage, and optional analytics or advertising disclosures.",
    changefreq: 'monthly',
    priority: '0.4',
  },
  {
    path: '/terms-and-conditions',
    title: 'Terms & Conditions | ToolMitra',
    description:
      "Review the Terms and Conditions governing access and acceptable use of ToolMitra's free browser-based online utilities.",
    changefreq: 'monthly',
    priority: '0.4',
  },
  {
    path: '/disclaimer',
    title: 'Disclaimer | ToolMitra',
    description:
      "General utility and accuracy disclaimer for ToolMitra's free browser-based calculators, converters, and file optimization tools.",
    changefreq: 'monthly',
    priority: '0.4',
  },
];

const TOOL_ROUTES: PrerenderRouteMeta[] = TOOLS.map((tool) => ({
  path: tool.path,
  title: tool.seoTitle,
  description: tool.seoDescription,
  changefreq: 'weekly',
  priority: '0.9',
  structuredData: (origin) => {
    const schemas: Array<Record<string, unknown>> = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: tool.name,
        ...(origin ? { url: `${origin}${tool.path}` } : {}),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'All',
        description: tool.seoDescription,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: tool.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ];

    if (origin) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'All Tools', item: `${origin}/tools` },
          { '@type': 'ListItem', position: 3, name: tool.name, item: `${origin}${tool.path}` },
        ],
      });
    }

    return schemas;
  },
}));

export const INDEXABLE_ROUTES: PrerenderRouteMeta[] = [...STATIC_ROUTES, ...TOOL_ROUTES];

export const NOT_FOUND_ROUTE_META: PrerenderRouteMeta = {
  path: '/404',
  title: '404 – Page Not Found | ToolMitra',
  description:
    'The requested page could not be found on ToolMitra. Return to the home page or browse all free online tools.',
  changefreq: 'monthly',
  priority: '0.0',
  noindex: true,
};

export const ALL_PRERENDER_ROUTES: PrerenderRouteMeta[] = [
  ...INDEXABLE_ROUTES,
  NOT_FOUND_ROUTE_META,
];

export function getPrerenderMetaForPath(urlPath: string): PrerenderRouteMeta {
  const clean = urlPath === '/' ? '/' : urlPath.replace(/\/+$/, '');
  return (
    ALL_PRERENDER_ROUTES.find((route) => route.path === clean) ?? NOT_FOUND_ROUTE_META
  );
}
