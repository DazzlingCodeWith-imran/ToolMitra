import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '@/src/config/site';
import { TOOLS } from '@/src/data/tools';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              to="/"
              className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100"
            >
              {SITE_CONFIG.name}
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {SITE_CONFIG.tagline}. Practical utilities that run directly inside your browser with
              no file uploads or account barriers.
            </p>
            {SITE_CONFIG.contactEmail && (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Contact:{' '}
                <a
                  href={`mailto:${SITE_CONFIG.contactEmail}`}
                  className="font-medium text-slate-800 underline underline-offset-2 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                >
                  {SITE_CONFIG.contactEmail}
                </a>
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              Popular Tools
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {TOOLS.map((tool) => (
                <li key={tool.id}>
                  <Link
                    to={tool.path}
                    className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  to="/tools"
                  className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  All Tools Directory
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              Legal & Privacy
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-and-conditions"
                  className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  to="/disclaimer"
                  className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center dark:border-slate-800 dark:text-slate-400">
          <p>
            © {currentYear} {SITE_CONFIG.name}. All rights reserved.
          </p>
          <p>Client-side processing · No account required</p>
        </div>
      </div>
    </footer>
  );
}
