import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { SITE_CONFIG } from '@/src/config/site';

export function TermsPage() {
  return (
    <>
      <SeoHead
        title="Terms & Conditions | ToolMitra"
        description="Review the Terms and Conditions governing access and acceptable use of ToolMitra's free browser-based online utilities."
        path="/terms-and-conditions"
      />

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Terms & Conditions' }]} />

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
          Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Last updated: November 23, 2026 · {SITE_CONFIG.name}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              1. Acceptance of Terms
            </h2>
            <p className="mt-2">
              By accessing or using {SITE_CONFIG.name}, you agree to these Terms &amp; Conditions. If
              you do not agree with any part of these terms, please discontinue use of the website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              2. Description of Service
            </h2>
            <p className="mt-2">
              {SITE_CONFIG.name} provides free, browser-based utilities for everyday productivity,
              including image compression, image-to-PDF conversion, QR code generation, word
              counting, and date/age calculation. All tools are provided on an &ldquo;as is&rdquo;
              and &ldquo;as available&rdquo; basis without uptime guarantees.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              3. Acceptable Use
            </h2>
            <p className="mt-2">
              You remain solely responsible for the files, text, links, and outputs you process
              using {SITE_CONFIG.name}. You agree not to use the website to distribute unlawful
              content, conduct automated scraping that degrades service availability, or attempt to
              bypass security controls.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              4. Intellectual Property
            </h2>
            <p className="mt-2">
              You retain all rights to the images, documents, and text you process with our tools.
              The {SITE_CONFIG.name} interface design, brand name, and original website copy remain
              the property of the site operator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              5. Limitation of Liability
            </h2>
            <p className="mt-2">
              To the fullest extent permitted by applicable law, {SITE_CONFIG.name} is not liable
              for any direct, indirect, incidental, or consequential damages resulting from your use
              of or inability to use the tools, including data loss from browser crashes or
              unverified outputs. Always keep backups of original files.
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
