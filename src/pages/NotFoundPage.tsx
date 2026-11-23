import { ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeoHead } from '@/src/components/common/SeoHead';

export function NotFoundPage() {
  return (
    <>
      <SeoHead
        title="404 – Page Not Found | ToolMitra"
        description="The requested page could not be found on ToolMitra. Return to the home page or browse all free online tools."
        path="/404"
        noindex
      />

      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
          Page not found
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          The URL you visited does not exist or may have moved. You can head back to the home page
          or open the tools directory.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>
          <Link
            to="/tools"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Browse All Tools</span>
          </Link>
        </div>
      </div>
    </>
  );
}
