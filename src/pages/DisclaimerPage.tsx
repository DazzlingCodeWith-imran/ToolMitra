import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { SITE_CONFIG } from '@/src/config/site';

export function DisclaimerPage() {
  return (
    <>
      <SeoHead
        title="Disclaimer | ToolMitra"
        description="General utility and accuracy disclaimer for ToolMitra's free browser-based calculators, converters, and file optimization tools."
        path="/disclaimer"
      />

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Disclaimer' }]} />

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
          Disclaimer
        </h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Last updated: November 23, 2026 · {SITE_CONFIG.name}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              General Utility Purpose
            </h2>
            <p className="mt-2">
              The tools and informational guides on {SITE_CONFIG.name} are provided for general
              everyday convenience and productivity. While care is taken to ensure accurate date
              arithmetic, reliable file conversion, and valid QR encoding, results are provided
              without express or implied warranties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Verify Important Outputs
            </h2>
            <p className="mt-2">
              Before submitting compressed images, converted PDFs, printed QR codes, word counts, or
              age calculations for official applications, legal filings, academic submissions, or
              commercial print runs, please inspect and verify the output independently. Always
              retain copies of your original files before compressing or converting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              External Links &amp; QR Destinations
            </h2>
            <p className="mt-2">
              {SITE_CONFIG.name} does not review or endorse external URLs encoded into QR codes by
              users. Users are solely responsible for testing QR codes and verifying destination
              links prior to distribution.
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
