import { AlertCircle, Check, Copy, Info, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Breadcrumbs } from '@/src/components/common/Breadcrumbs';
import { SeoHead } from '@/src/components/common/SeoHead';
import { SITE_CONFIG } from '@/src/config/site';

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Feedback or Tool Suggestion');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [actionNotice, setActionNotice] = useState<{
    type: 'info' | 'warning';
    text: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const hasConfiguredEmail = Boolean(SITE_CONFIG.contactEmail);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim() || name.trim().length < 2) {
      next.name = 'Please enter your name (at least 2 characters).';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (!subject.trim()) {
      next.subject = 'Please select a topic.';
    }
    if (!message.trim() || message.trim().length < 10) {
      next.message = 'Please write a message of at least 10 characters.';
    }
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setActionNotice(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (hasConfiguredEmail) {
      const mailtoSubject = encodeURIComponent(`[ToolMitra] ${subject.trim()} — ${name.trim()}`);
      const mailtoBody = encodeURIComponent(
        `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`,
      );
      window.location.href = `mailto:${SITE_CONFIG.contactEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;
      setActionNotice({
        type: 'info',
        text: `Your default email client was requested to open a draft to ${SITE_CONFIG.contactEmail}. Nothing is sent automatically until you send it from your email app.`,
      });
      return;
    }

    const formattedDraft = `Topic: ${subject.trim()}\nName: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`;
    try {
      await navigator.clipboard.writeText(formattedDraft);
      setActionNotice({
        type: 'warning',
        text: 'No contact email or backend inbox is configured on this deployment, so no message was sent. Your drafted text was copied to your clipboard instead.',
      });
    } catch {
      setActionNotice({
        type: 'warning',
        text: 'No contact email or backend inbox is configured on this deployment, so this form cannot send messages yet.',
      });
    }
  };

  const handleCopyEmail = async () => {
    if (!SITE_CONFIG.contactEmail) return;
    try {
      await navigator.clipboard.writeText(SITE_CONFIG.contactEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Clipboard may be blocked in restricted contexts
    }
  };

  return (
    <>
      <SeoHead
        title="Contact Us – Feedback & Bug Reports | ToolMitra"
        description="Contact ToolMitra with bug reports, feature requests, or general questions about our free browser-based utilities."
        path="/contact"
      />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact Us' }]} />

        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
            Contact Us
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Spotted a bug, have a question about how a tool works, or want to suggest a new utility?
            Prepare an inquiry below.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Configurable Direct Contact Column */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-950 dark:text-blue-400">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Direct Contact
              </h2>

              {hasConfiguredEmail ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Reach the {SITE_CONFIG.name} team via email:
                  </p>
                  <p className="break-all text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {SITE_CONFIG.contactEmail}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy email</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  No public contact email is configured yet. Set{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
                    VITE_CONTACT_EMAIL
                  </code>{' '}
                  in your deployment environment variables to enable direct email routing.
                </p>
              )}

              <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {SITE_CONFIG.contactLocation}
              </p>
            </div>
          </div>

          {/* Honest Contact Form */}
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
            >
              {!hasConfiguredEmail && (
                <div
                  role="note"
                  className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Direct email sending is disabled because <strong>VITE_CONTACT_EMAIL</strong> is
                    not configured. Submitting here validates and copies your draft locally instead
                    of sending an email.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  {errors.name && (
                    <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  {errors.email && (
                    <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="contact-subject"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Topic
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Feedback or Tool Suggestion">Feedback or Tool Suggestion</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Privacy or Legal Inquiry">Privacy or Legal Inquiry</option>
                  <option value="General Question">General Question</option>
                </select>
                {errors.subject && (
                  <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {errors.subject}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share details, browser type, or suggestions..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {errors.message && (
                  <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {errors.message}
                  </p>
                )}
              </div>

              {actionNotice && (
                <div
                  role="status"
                  className={`mt-5 flex items-start gap-2.5 rounded-lg border p-3.5 text-sm ${
                    actionNotice.type === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
                      : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200'
                  }`}
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{actionNotice.text}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Do not include sensitive passwords or private files.
                </p>
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
                >
                  {hasConfiguredEmail ? (
                    <>
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      <span>Open in Email App</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copy Draft Locally</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
