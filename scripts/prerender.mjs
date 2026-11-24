import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');
const templatePath = path.join(distDir, 'index.html');
const ssrEntryPath = path.join(rootDir, 'dist-ssr', 'entry-server.js');

if (!fs.existsSync(templatePath)) {
  throw new Error('dist/index.html not found. Run vite build first.');
}
if (!fs.existsSync(ssrEntryPath)) {
  throw new Error('dist-ssr/entry-server.js not found. Run vite build --ssr first.');
}

function normalizeOrigin(raw) {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === 'MY_APP_URL' || trimmed.includes('toolmitra.example.com')) {
    return '';
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.origin;
  } catch {
    return '';
  }
}

const resolvedOrigin =
  normalizeOrigin(process.env.VITE_SITE_URL) ||
  normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  normalizeOrigin(process.env.VERCEL_URL) ||
  normalizeOrigin(process.env.APP_URL) ||
  '';

const gscVerification = (process.env.VITE_GSC_VERIFICATION || '').trim();
const templateHtml = fs.readFileSync(templatePath, 'utf-8');

const ssrModule = await import(pathToFileURL(ssrEntryPath).href);
const { render, ALL_PRERENDER_ROUTES, INDEXABLE_ROUTES } = ssrModule;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtmlForRoute(routeMeta) {
  const result = render(routeMeta.path, resolvedOrigin);
  const canonicalUrl = resolvedOrigin
    ? `${resolvedOrigin}${routeMeta.path === '/' ? '/' : routeMeta.path}`
    : '';

  let pageHtml = templateHtml.replace(
    '<div id="root"></div>',
    `<div id="root">${result.html}</div>`,
  );

  pageHtml = pageHtml.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(result.title)}</title>`);
  pageHtml = pageHtml.replace(
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeAttr(result.description)}" />`,
  );
  pageHtml = pageHtml.replace(
    /<meta\s+property="og:title"[\s\S]*?\/>/,
    `<meta property="og:title" content="${escapeAttr(result.title)}" />`,
  );
  pageHtml = pageHtml.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${escapeAttr(result.description)}" />`,
  );
  pageHtml = pageHtml.replace(
    /<meta\s+name="twitter:title"[\s\S]*?\/>/,
    `<meta name="twitter:title" content="${escapeAttr(result.title)}" />`,
  );
  pageHtml = pageHtml.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${escapeAttr(result.description)}" />`,
  );

  const extraHeadTags = [];
  if (result.noindex) {
    extraHeadTags.push('<meta name="robots" content="noindex, follow" />');
  } else if (canonicalUrl) {
    extraHeadTags.push(`<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`);
    extraHeadTags.push(`<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`);
  }

  if (gscVerification) {
    extraHeadTags.push(
      `<meta name="google-site-verification" content="${escapeAttr(gscVerification)}" />`,
    );
  }

  for (const schema of result.schemas) {
    extraHeadTags.push(
      `<script type="application/ld+json" data-toolmitra-jsonld="true">${JSON.stringify(schema)}</script>`,
    );
  }

  pageHtml = pageHtml.replace('</head>', `    ${extraHeadTags.join('\n    ')}\n  </head>`);
  return pageHtml;
}

for (const routeMeta of ALL_PRERENDER_ROUTES) {
  const renderedHtml = buildHtmlForRoute(routeMeta);

  if (routeMeta.path === '/') {
    fs.writeFileSync(path.join(distDir, 'index.html'), renderedHtml, 'utf-8');
  } else if (routeMeta.path === '/404') {
    fs.writeFileSync(path.join(distDir, '404.html'), renderedHtml, 'utf-8');
  } else {
    const cleanRel = routeMeta.path.replace(/^\/+/, '');
    const outDir = path.join(distDir, cleanRel);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderedHtml, 'utf-8');
  }
}

const publicRobotsPath = path.join(publicDir, 'robots.txt');
const existingRobotsTxt = fs.existsSync(publicRobotsPath)
  ? fs.readFileSync(publicRobotsPath, 'utf-8')
  : 'User-agent: *\nAllow: /\n';

function upsertSitemapDirective(content, sitemapLine) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const sitemapPattern = /^\s*sitemap\s*:/i;

  let replaced = false;
  const nextLines = [];

  for (const line of lines) {
    if (sitemapPattern.test(line)) {
      if (!replaced) {
        nextLines.push(sitemapLine);
        replaced = true;
      }
    } else {
      nextLines.push(line);
    }
  }

  if (!replaced) {
    while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') {
      nextLines.pop();
    }
    if (nextLines.length > 0) {
      nextLines.push('');
    }
    nextLines.push(sitemapLine);
    nextLines.push('');
  }

  return nextLines.join(eol);
}

fs.mkdirSync(publicDir, { recursive: true });

if (resolvedOrigin) {
  const todayIso = new Date().toISOString().split('T')[0];
  const sitemapEntries = INDEXABLE_ROUTES.map((route) => {
    const loc = `${resolvedOrigin}${route.path === '/' ? '/' : route.path}`;
    return `  <url>
    <loc>${escapeAttr(loc)}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  }).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;

  const robotsTxt = upsertSitemapDirective(
    existingRobotsTxt,
    `Sitemap: ${resolvedOrigin}/sitemap.xml`,
  );

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf-8');

  console.log(
    `Prerendered ${ALL_PRERENDER_ROUTES.length} routes, sitemap.xml (${INDEXABLE_ROUTES.length} URLs), and robots.txt for ${resolvedOrigin}`,
  );
} else {
  for (const staleSitemap of [path.join(distDir, 'sitemap.xml'), path.join(publicDir, 'sitemap.xml')]) {
    if (fs.existsSync(staleSitemap)) fs.unlinkSync(staleSitemap);
  }
  fs.writeFileSync(path.join(distDir, 'robots.txt'), existingRobotsTxt, 'utf-8');

  console.warn(
    `Prerendered ${ALL_PRERENDER_ROUTES.length} routes without a site origin (set VITE_SITE_URL or deploy on Vercel to emit canonicals and sitemap.xml).`,
  );
}