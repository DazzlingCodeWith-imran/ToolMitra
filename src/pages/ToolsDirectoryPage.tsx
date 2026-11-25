import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { ToolCard } from '@/src/components/common/ToolCard';
import { TOOL_CATEGORIES, TOOLS, type ToolCategory } from '@/src/data/tools';

export function ToolsDirectoryPage() {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ToolCategory>('All');
  const [query, setQuery] = useState('');

  // Only show categories that contain real implemented tools, with accurate counts
  const categoryItems = useMemo(() => {
    const counts = new Map<ToolCategory, number>();
    for (const tool of TOOLS) {
      counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    }

    return TOOL_CATEGORIES.filter((cat) => cat === 'All' || (counts.get(cat) ?? 0) > 0).map(
      (cat) => ({
        name: cat,
        count: cat === 'All' ? TOOLS.length : counts.get(cat) ?? 0,
      }),
    );
  }, []);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
      const matchesQuery =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        tool.secondaryKeywords.some((kw) => kw.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, query]);

  return (
    <>
      <SeoHead
        title="All Free Online PDF & Utility Tools – ToolMitra Directory"
        description={`Browse ToolMitra's collection of ${TOOLS.length} free, browser-based tools for PDF organization, compression, conversion, editing, redaction, OCR, image conversion, QR codes, writing, and calculators.`}
        path="/tools"
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'All Tools' }]} />

        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
            All Online Tools
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Filter by category or search by task. Every tool executes locally in your browser with
            clear format support and no account required.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-8 flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <label htmlFor="directory-search" className="sr-only">
                Filter tools by keyword
              </label>
              <input
                id="directory-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search PDF or utility tools..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
              />
            </div>

            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {filteredTools.length}
              </span>{' '}
              {filteredTools.length === 1 ? 'tool' : 'tools'}
              {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter tools by category"
            className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1.5 dark:bg-slate-900"
          >
            {categoryItems.map(({ name, count }) => {
              const active = selectedCategory === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(name)}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <span>{name}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div className="mt-8">
          {filteredTools.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No matching tools found
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Adjust your category selection or clear your search query.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setQuery('');
                }}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
