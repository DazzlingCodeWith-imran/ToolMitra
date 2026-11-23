import { ArrowRight, Search, ShieldCheck, Smartphone, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '@/src/components/common/SeoHead';
import { ToolCard } from '@/src/components/common/ToolCard';
import { getResolvedOrigin, SITE_CONFIG } from '@/src/config/site';
import { TOOLS } from '@/src/data/tools';

export function HomePage() {
  const [query, setQuery] = useState('');

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        tool.secondaryKeywords.some((kw) => kw.toLowerCase().includes(q)),
    );
  }, [query]);

  const homeSchema = useMemo(() => {
    const origin = getResolvedOrigin();
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_CONFIG.name,
      description: SITE_CONFIG.description,
      ...(origin ? { url: origin } : {}),
    };
  }, []);

  return (
    <>
      <SeoHead
        title="ToolMitra – Free Online Tools for Everyday Work"
        description={SITE_CONFIG.description}
        path="/"
        structuredData={homeSchema}
      />

      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {SITE_CONFIG.tagline}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
              Fast browser utilities without uploads, signups, or clutter.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Compress images, convert JPG files to PDF, create scannable QR codes, analyze text,
              and calculate exact dates directly on your device.
            </p>

            {/* Search & Primary CTA */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-md">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                <label htmlFor="home-tool-search" className="sr-only">
                  Search tools
                </label>
                <input
                  id="home-tool-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tools (e.g., compress, pdf, qr, word)..."
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
                />
              </div>

              <Link
                to="/tools"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                <span>Browse All Tools</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {query.trim() ? 'Matching Tools' : 'Essential Everyday Tools'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {filteredTools.length} {filteredTools.length === 1 ? 'utility' : 'utilities'} ready
              for local browser processing.
            </p>
          </div>
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="self-start text-sm font-medium text-blue-600 hover:underline sm:self-auto dark:text-blue-400"
            >
              Clear search
            </button>
          )}
        </div>

        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No tools matched "{query}"
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Try searching for image compression, PDF conversion, QR codes, word count, or age.
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Show all tools
            </button>
          </div>
        )}
      </section>

      {/* Architectural Value Props */}
      <section className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Built for speed, clarity, and privacy
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Every utility follows strict browser-first engineering so routine tasks take seconds
              instead of uploading files across third-party servers.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-400">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Local Browser Execution
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Images, PDFs, QR payloads, and text stay in your browser memory—nothing is uploaded
                or stored on remote servers.
              </p>
            </div>

            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-400">
                <Zap className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Zero Artificial Delays
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                No countdown timers, no login walls, and no deceptive download buttons—just clean
                controls that respond immediately.
              </p>
            </div>

            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-400">
                <Smartphone className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Responsive & Accessible
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Designed with keyboard navigation, WCAG AA contrast in both light and dark modes,
                and touch-friendly mobile controls.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
