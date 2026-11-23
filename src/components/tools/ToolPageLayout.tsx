import { ChevronDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AdSlot } from '@/src/components/common/AdSlot';
import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { ToolCard } from '@/src/components/common/ToolCard';
import { ToolIcon } from '@/src/components/common/ToolIcon';
import { getResolvedOrigin } from '@/src/config/site';
import { TOOLS, type ToolDefinition } from '@/src/data/tools';

interface ToolPageLayoutProps {
  tool: ToolDefinition;
  children: ReactNode;
}

export function ToolPageLayout({ tool, children }: ToolPageLayoutProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const relatedTools = useMemo(
    () => TOOLS.filter((candidate) => candidate.id !== tool.id).slice(0, 3),
    [tool.id],
  );

  const structuredData = useMemo(() => {
    const origin = getResolvedOrigin();
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
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${origin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'All Tools',
            item: `${origin}/tools`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: tool.name,
            item: `${origin}${tool.path}`,
          },
        ],
      });
    }

    return schemas;
  }, [tool]);

  return (
    <>
      <SeoHead
        title={tool.seoTitle}
        description={tool.seoDescription}
        path={tool.path}
        structuredData={structuredData}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'All Tools', to: '/tools' },
            { label: tool.name },
          ]}
        />

        {/* Tool Header */}
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-400">
              <ToolIcon name={tool.iconName} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tool.category}
                <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
                  ·
                </span>
                Runs locally in your browser
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
                {tool.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
                {tool.shortDescription}
              </p>
            </div>
          </div>
        </header>

        {/* Supported Formats & Limits Strip */}
        <div className="mt-5 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Supported formats:
            </span>{' '}
            {tool.supportedFormats}
          </p>
          <p className="text-slate-500 dark:text-slate-400">{tool.limitsSummary}</p>
        </div>

        {/* Interactive Workspace */}
        <section aria-label={`${tool.name} workspace`} className="mt-6">
          {children}
        </section>

        {/* Unobtrusive environment-gated AdSense slot */}
        <AdSlot slotId={`tool-${tool.slug}-bottom`} />

        {/* How to Use Section */}
        <section className="mt-12 border-t border-slate-200 pt-10 dark:border-slate-800">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            How to use the {tool.name}
          </h2>
          <ol className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
            {tool.howToSteps.map((step, index) => (
              <li
                key={step}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  0{index + 1}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ Accordion */}
        <section className="mt-12 border-t border-slate-200 pt-10 dark:border-slate-800">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Frequently Asked Questions
          </h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {tool.faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/50"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Internal Linking: Related Tools */}
        <section className="mt-12 border-t border-slate-200 pt-10 dark:border-slate-800">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              More Free Tools
            </h2>
            <Link
              to="/tools"
              className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              View all tools
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedTools.map((item) => (
              <ToolCard key={item.id} tool={item} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
