import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Download,
  FileUp,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  convertHtmlToPdfBytes,
  MAX_HTML_INPUT_CHARS,
  sanitizeHtmlForPrint,
  type HtmlPageOrientation,
  type HtmlPageSize,
} from '@/src/utils/htmlToPdf';

const SAMPLE_HTML = `<h1>Quarterly Project Summary</h1>
<p>Prepared for stakeholders using client-side HTML-to-PDF conversion. Structured headings, paragraphs, lists, quotes, code blocks, and HTML tables render cleanly without sending files to a remote server.</p>

<h2>Key Milestones</h2>
<ul>
  <li>Completed browser-side document workflow engine with zero server uploads.</li>
  <li>Verified accessibility contrast across light and dark mode themes.</li>
  <li>Published automated unit verification for every file utility.</li>
</ul>

<blockquote>Note: Keep document formatting semantic with standard tags such as h1-h4, p, ul, ol, pre, and table.</blockquote>

<h2>Budget Summary</h2>
<table>
  <tr>
    <th>Workstream</th>
    <th>Owner</th>
    <th>Status</th>
  </tr>
  <tr>
    <td>Core Document Tools</td>
    <td>Engineering</td>
    <td>Ready</td>
  </tr>
  <tr>
    <td>Documentation &amp; QA</td>
    <td>Operations</td>
    <td>Approved</td>
  </tr>
</table>`;

interface HtmlPdfOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
  blockCount: number;
}

export function HtmlToPdfTool() {
  const [htmlInput, setHtmlInput] = useState(SAMPLE_HTML);
  const [documentTitle, setDocumentTitle] = useState('ToolMitra Document');
  const [pageSize, setPageSize] = useState<HtmlPageSize>('a4');
  const [orientation, setOrientation] = useState<HtmlPageOrientation>('portrait');
  const [marginPt, setMarginPt] = useState(42);
  const [baseFontSize, setBaseFontSize] = useState(11);

  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<HtmlPdfOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlRef = useRef<string | null>(null);

  const clearOutput = () => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
    setOutput(null);
  };

  useEffect(() => {
    return () => {
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  const sanitizedPreviewDoc = useMemo(() => {
    const cleanBody = sanitizeHtmlForPrint(htmlInput);
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1e293b;padding:20px;margin:0;font-size:${baseFontSize}pt;}h1,h2,h3,h4{color:#0f172a;margin-top:1em;margin-bottom:0.4em;}table{border-collapse:collapse;width:100%;margin:12px 0;}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;font-size:0.92em;}th{background:#f1f5f9;}blockquote{border-left:3px solid #2563eb;padding-left:12px;color:#475569;font-style:italic;margin:12px 0;}pre{background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;overflow-x:auto;}</style></head><body>${cleanBody}</body></html>`;
  }, [htmlInput, baseFontSize]);

  const handleLoadHtmlFile = async (file: File | undefined) => {
    if (!file) return;
    setErrorMessage(null);
    clearOutput();
    const text = await file.text();
    if (text.length > MAX_HTML_INPUT_CHARS) {
      setErrorMessage('Uploaded HTML file exceeds the 250,000-character limit.');
      return;
    }
    setHtmlInput(text);
  };

  const handleConvert = async () => {
    clearOutput();
    setErrorMessage(null);
    setIsConverting(true);
    setStatusMessage('Parsing sanitized HTML...');

    try {
      const result = await convertHtmlToPdfBytes(
        htmlInput,
        {
          pageSize,
          orientation,
          marginPt,
          baseFontSize,
          title: documentTitle,
        },
        (msg) => setStatusMessage(msg),
      );
      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        url,
        filename: `${(documentTitle || 'html-document')
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/gi, '-')
          .replace(/^-+|-+$/g, '') || 'html-document'}.pdf`,
        size: blob.size,
        pageCount: result.pageCount,
        blockCount: result.blockCount,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to convert HTML to PDF.');
      setStatusMessage(null);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* HTML Editor & Options */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="html-source-textarea"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              <Code2 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>HTML Markup Input</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,text/html"
                onChange={(e) => {
                  void handleLoadHtmlFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Load .html File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setHtmlInput('');
                  clearOutput();
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            id="html-source-textarea"
            rows={13}
            value={htmlInput}
            onChange={(e) => {
              setHtmlInput(e.target.value);
              clearOutput();
            }}
            placeholder="<h1>Document Title</h1><p>Write or paste HTML here...</p>"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="html-pdf-title"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                PDF File / Title
              </label>
              <input
                id="html-pdf-title"
                type="text"
                maxLength={80}
                value={documentTitle}
                onChange={(e) => {
                  setDocumentTitle(e.target.value);
                  clearOutput();
                }}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="html-page-size"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Page Size
                </label>
                <select
                  id="html-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value as HtmlPageSize);
                    clearOutput();
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="a4">A4</option>
                  <option value="letter">US Letter</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="html-orientation"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Orientation
                </label>
                <select
                  id="html-orientation"
                  value={orientation}
                  onChange={(e) => {
                    setOrientation(e.target.value as HtmlPageOrientation);
                    clearOutput();
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-500">Margins: {marginPt} pt</span>
              <input
                type="range"
                aria-label="Page margins in points"
                min={24}
                max={72}
                step={4}
                value={marginPt}
                onChange={(e) => {
                  setMarginPt(Number(e.target.value));
                  clearOutput();
                }}
                className="mt-1 w-full accent-blue-600"
              />
            </div>
            <div>
              <span className="text-xs text-slate-500">Body Font: {baseFontSize} pt</span>
              <input
                type="range"
                aria-label="Base font size"
                min={9}
                max={15}
                value={baseFontSize}
                onChange={(e) => {
                  setBaseFontSize(Number(e.target.value));
                  clearOutput();
                }}
                className="mt-1 w-full accent-blue-600"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isConverting}
            onClick={() => void handleConvert()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
          >
            {isConverting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isConverting ? 'Converting HTML...' : 'Convert HTML to PDF'}</span>
          </button>
        </div>

        {/* Sandboxed Live Preview */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sandboxed Live Preview
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Scripts &amp; unsafe handlers stripped
            </span>
          </div>
          <iframe
            title="Sanitized HTML Document Preview"
            sandbox=""
            srcDoc={sanitizedPreviewDoc}
            className="min-h-[380px] w-full flex-1 rounded-lg border border-slate-200 bg-white dark:border-slate-800"
          />
        </div>
      </div>

      {(isConverting || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Rendering PDF...'}</p>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {output && (
        <div
          role="status"
          className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center dark:border-emerald-900/60 dark:bg-emerald-950/40"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                PDF generated: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                {output.pageCount} {output.pageCount === 1 ? 'page' : 'pages'} · {output.blockCount}{' '}
                rendered blocks · {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download PDF</span>
          </a>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          HTML markup is sanitized locally (all scripts and active event handlers are stripped) and
          converted to a multi-page vector PDF in browser memory. External CSS frameworks or remote
          web fonts are not fetched; semantic HTML headings, lists, quotes, code blocks, and tables
          are styled automatically.
        </p>
      </div>
    </div>
  );
}
