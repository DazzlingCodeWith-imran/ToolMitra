import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { SITE_CONFIG } from '@/src/config/site';

export function PrivacyPolicyPage() {
  return (
    <>
      <SeoHead
        title="Privacy Policy – Local Processing & Data Practices | ToolMitra"
        description="Read ToolMitra's Privacy Policy explaining client-side browser processing, local theme storage, and optional analytics or advertising disclosures."
        path="/privacy-policy"
      />

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Privacy Policy' }]} />

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Effective date: November 23, 2026 · {SITE_CONFIG.name}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              1. Local Browser Processing
            </h2>
            <p className="mt-2">
              {SITE_CONFIG.name} is designed so that its core utilities—including the Image
              Compressor, JPG to PDF Converter, QR Code Generator, Word Counter, and Age
              Calculator—run directly in your web browser. Files you select, text you paste, QR
              inputs you encode, and dates you calculate are processed in your device&apos;s memory
              and are not uploaded to our servers for processing or storage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              2. Browser Storage & Preferences
            </h2>
            <p className="mt-2">
              We store your visual theme preference (light or dark mode) in your browser&apos;s{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
                localStorage
              </code>{' '}
              under the key{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
                toolmitra-theme
              </code>
              . This preference stays on your device and is not used to track you across websites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              3. Information You Voluntarily Provide
            </h2>
            <p className="mt-2">
              You do not need an account to use any tool on {SITE_CONFIG.name}. If you choose to
              contact us via email or a configured contact channel, we use the name, email address,
              and message content you submit solely to respond to your inquiry or address reported
              technical issues.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              4. Hosting Logs, Web Fonts, Analytics &amp; Advertising Readiness
            </h2>
            <p className="mt-2">
              When hosted on static/edge web infrastructure, standard HTTP access logs (such as IP
              address, browser user-agent, and requested URL) may be temporarily processed by the
              hosting provider for security, rate limiting, and reliability. Typography stylesheets
              and font files are loaded from Google Fonts, which receives standard browser HTTP
              request metadata.
            </p>
            <p className="mt-3">
              If Google Analytics or Google AdSense is enabled on a deployed instance in the future,
              those third-party services may use cookies or similar identifiers in accordance with
              their respective privacy policies and applicable regional consent requirements. No
              analytics or advertising scripts are active unless explicitly configured by the site
              operator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              5. Questions & Updates
            </h2>
            <p className="mt-2">
              We may update this Privacy Policy as new tools or optional platform features are
              introduced. Questions regarding privacy practices can be directed through our Contact
              page
              {SITE_CONFIG.contactEmail ? ` or by emailing ${SITE_CONFIG.contactEmail}` : ''}.
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
