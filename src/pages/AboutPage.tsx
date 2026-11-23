import { CheckCircle2, Cpu, EyeOff, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { SITE_CONFIG } from '@/src/config/site';

export function AboutPage() {
  return (
    <>
      <SeoHead
        title="About Us – How ToolMitra Works | ToolMitra"
        description="Learn how ToolMitra provides fast, privacy-first online tools that run directly inside your browser without uploading files or requiring accounts."
        path="/about"
      />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About Us' }]} />

        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
            About {SITE_CONFIG.name}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            {SITE_CONFIG.tagline}. We build straightforward web utilities that respect your time
            and keep your files on your own device.
          </p>
        </header>

        <section className="mt-10 space-y-6 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
          <p>
            Routine digital tasks—shrinking an image before uploading a form, combining scanned
            photos into a PDF, creating a clean QR code for a flyer, checking a draft&apos;s word
            count, or verifying an exact age—should not require installing heavy software, creating
            an account, or handing personal files over to unknown servers.
          </p>
          <p>
            {SITE_CONFIG.name} is engineered around a browser-first architecture. Every initial tool
            on the platform processes inputs locally inside your browser tab using standard web APIs
            and client-side libraries. Once the page loads, your images, documents, text drafts, and
            dates remain strictly on your device.
          </p>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-8 border-t border-slate-200 pt-10 md:grid-cols-3 dark:border-slate-800">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-400">
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No File Uploads
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Image compression, PDF creation, QR generation, and text analysis happen in browser
              memory rather than on a remote upload server.
            </p>
          </div>

          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-400">
              <Cpu className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              No Login Walls
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Open any tool and use it immediately without creating an account, confirming an email,
              or hitting artificial daily timers.
            </p>
          </div>

          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-400">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Transparent Limits
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Each utility clearly documents supported formats, recommended file sizes, and how
              results are calculated.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Quality & Sustainability
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>
                All utilities are free to access and designed to work smoothly on mobile, tablet,
                and desktop screens.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>
                In the future, unobtrusive advertising may help cover hosting and maintenance costs
                without interrupting core tool workflows.
              </span>
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/tools"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              Explore All Tools
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
