import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Loader2,
  ScanText,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import {
  MAX_OCR_FILE_BYTES,
  MAX_OCR_PAGES,
  OCR_LANGUAGES,
  runBrowserOcrOnPdf,
  type OcrLanguageCode,
} from '@/src/utils/pdfOcr';
import { parsePageRanges, sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedOcrPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface OcrOutput {
  text: string;
  pdfUrl: string;
  pdfFilename: string;
  pdfSize: number;
  scannedPages: number;
}

export function OcrPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedOcrPdf | null>(null);
  const [language, setLanguage] = useState<OcrLanguageCode>('eng');
  const [pageScope, setPageScope] = useState<'all' | 'range'>('all');
  const [rangeInput, setRangeInput] = useState('1');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<OcrOutput | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const clearOutput = () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setOutput(null);
  };

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  const handleLoadPdf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_OCR_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 35 MB.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      if (pageCount > MAX_OCR_PAGES) {
        setPageScope('range');
        setRangeInput(`1-${MAX_OCR_PAGES}`);
      } else {
        setPageScope('all');
        setRangeInput(pageCount > 1 ? `1-${pageCount}` : '1');
      }
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const targetPages = useMemo(() => {
    if (!sourcePdf) return { valid: false, pages: [] as number[], error: null as string | null };
    if (pageScope === 'all') {
      if (sourcePdf.pageCount > MAX_OCR_PAGES) {
        return {
          valid: false,
          pages: [],
          error: `Browser OCR processes up to ${MAX_OCR_PAGES} pages per run. Switch to Custom Range.`,
        };
      }
      return {
        valid: true,
        pages: Array.from({ length: sourcePdf.pageCount }, (_, i) => i + 1),
        error: null,
      };
    }

    const parsed = parsePageRanges(rangeInput, sourcePdf.pageCount);
    if (!parsed.valid) return { valid: false, pages: [], error: parsed.error };
    if (parsed.flatUniquePages.length > MAX_OCR_PAGES) {
      return {
        valid: false,
        pages: [],
        error: `Select at most ${MAX_OCR_PAGES} pages per OCR run to keep browser memory responsive.`,
      };
    }
    return { valid: true, pages: parsed.flatUniquePages, error: null };
  }, [sourcePdf, pageScope, rangeInput]);

  const handleRunOcr = async () => {
    if (!sourcePdf || !targetPages.valid || targetPages.pages.length === 0) return;

    clearOutput();
    setErrorMessage(null);
    setIsRunningOcr(true);
    setStatusMessage('Initializing Tesseract OCR worker...');

    try {
      const res = await runBrowserOcrOnPdf(
        sourcePdf.bytes,
        {
          pageNumbers: targetPages.pages,
          language,
        },
        (msg) => setStatusMessage(msg),
      );
      const blob = new Blob([res.searchablePdfBytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;

      setOutput({
        text: res.combinedText,
        pdfUrl: url,
        pdfFilename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-searchable-ocr.pdf`,
        pdfSize: blob.size,
        scannedPages: res.pageResults.length,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `${err.message} Note: OCR downloads language training data (~4 MB) from the Tesseract CDN on first use.`
          : 'Failed to run browser OCR.',
      );
      setStatusMessage(null);
    } finally {
      setIsRunningOcr(false);
    }
  };

  const handleCopyText = async () => {
    if (!output?.text) return;
    try {
      await navigator.clipboard.writeText(output.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Clipboard access denied by browser.');
    }
  };

  const handleDownloadTxt = () => {
    if (!output?.text || !sourcePdf) return;
    const blob = new Blob([output.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-ocr.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setIsDragging(false);
          void handleLoadPdf(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="ocr-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void handleLoadPdf(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <FileUp className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {sourcePdf
            ? `Loaded: ${sourcePdf.file.name} (${sourcePdf.pageCount} ${
                sourcePdf.pageCount === 1 ? 'page' : 'pages'
              })`
            : 'Drop a scanned PDF here to recognize text & create a searchable PDF'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to 25 pages per run · 35 MB max · Powered locally by Tesseract.js WebAssembly
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isRunningOcr}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isRunningOcr}
              onClick={() => {
                clearOutput();
                setSourcePdf(null);
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {(isLoadingFile || isRunningOcr || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Running OCR...'}</p>
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

      {sourcePdf && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ocr-language"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Document Language
              </label>
              <select
                id="ocr-language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value as OcrLanguageCode);
                  clearOutput();
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {OCR_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pages to Recognize
              </span>
              <div className="mt-1 flex gap-2">
                <select
                  aria-label="OCR page scope"
                  value={pageScope}
                  onChange={(e) => {
                    setPageScope(e.target.value as 'all' | 'range');
                    clearOutput();
                  }}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="all">All Pages ({sourcePdf.pageCount})</option>
                  <option value="range">Custom Range</option>
                </select>
                {pageScope === 'range' && (
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => {
                      setRangeInput(e.target.value);
                      clearOutput();
                    }}
                    placeholder="e.g., 1-5"
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                )}
              </div>
              {!targetPages.valid && targetPages.error && (
                <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {targetPages.error}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!targetPages.valid || isRunningOcr || isLoadingFile}
            onClick={() => void handleRunOcr()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
          >
            {isRunningOcr ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ScanText className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isRunningOcr ? 'Running Browser OCR...' : 'Recognize Text (OCR)'}</span>
          </button>
        </div>
      )}

      {output && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  OCR complete across {output.scannedPages}{' '}
                  {output.scannedPages === 1 ? 'page' : 'pages'}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                  Searchable PDF: {formatBytes(output.pdfSize)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyText()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download .txt</span>
              </button>
              <a
                href={output.pdfUrl}
                download={output.pdfFilename}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Searchable PDF</span>
              </a>
            </div>
          </div>

          <textarea
            aria-label="OCR recognized text"
            rows={12}
            value={output.text}
            readOnly
            className="w-full rounded-lg border border-slate-300 bg-white p-3.5 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Your PDF pages stay inside browser memory and are recognized locally via Tesseract
          WebAssembly—no document pages are uploaded to external OCR servers. Note: the browser
          downloads the chosen language training pack (~4 MB) from the Tesseract CDN once when
          initializing OCR.
        </p>
      </div>
    </div>
  );
}
