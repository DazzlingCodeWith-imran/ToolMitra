import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';
import {
  extractPdfToMarkdown,
  MAX_MARKDOWN_FILE_BYTES,
} from '@/src/utils/pdfToMarkdown';

interface LoadedMarkdownPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

export function PdfToMarkdownTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedMarkdownPdf | null>(null);
  const [detectHeadings, setDetectHeadings] = useState(true);
  const [includePageSeparators, setIncludePageSeparators] = useState(true);

  const [markdown, setMarkdown] = useState('');
  const [stats, setStats] = useState<{ wordCount: number; nonEmptyPages: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runExtraction = async (
    bytes: Uint8Array,
    opts: { detectHeadings: boolean; includePageSeparators: boolean },
  ) => {
    setIsExtracting(true);
    setErrorMessage(null);
    setStatusMessage('Extracting text and reconstructing Markdown...');

    try {
      const res = await extractPdfToMarkdown(bytes, opts, (msg) => setStatusMessage(msg));
      setMarkdown(res.markdown);
      setStats({ wordCount: res.wordCount, nonEmptyPages: res.nonEmptyPages });
      if (!res.markdown) {
        setErrorMessage(
          'No embedded selectable text found in this PDF. If this is a scanned document, use OCR PDF first.',
        );
      }
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to extract Markdown.');
      setStatusMessage(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLoadPdf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    setMarkdown('');
    setStats(null);

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_MARKDOWN_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 50 MB.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setIsLoadingFile(false);
      await runExtraction(bytes, { detectHeadings, includePageSeparators });
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
      setIsLoadingFile(false);
    }
  };

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Clipboard access denied by browser. Select text and copy manually.');
    }
  };

  const handleDownloadMd = () => {
    if (!markdown || !sourcePdf) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}.md`;
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
          id="pdf-to-markdown-input"
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
              } · ${formatBytes(sourcePdf.size)})`
            : 'Drop a PDF file here to extract clean Markdown (.md)'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Detects headings, lists, and paragraphs locally
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isExtracting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isExtracting}
              onClick={() => {
                setSourcePdf(null);
                setMarkdown('');
                setStats(null);
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

      {(isLoadingFile || isExtracting || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Extracting Markdown...'}</p>
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
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={detectHeadings}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setDetectHeadings(next);
                    void runExtraction(sourcePdf.bytes, {
                      detectHeadings: next,
                      includePageSeparators,
                    });
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                <span>Infer headings (#, ##) from font sizes</span>
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includePageSeparators}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIncludePageSeparators(next);
                    void runExtraction(sourcePdf.bytes, {
                      detectHeadings,
                      includePageSeparators: next,
                    });
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                <span>Insert page separators (---)</span>
              </label>
            </div>

            {stats && markdown && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMd}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download .md</span>
                </button>
              </div>
            )}
          </div>

          {stats && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>
                Extracted {stats.wordCount.toLocaleString()} words across {stats.nonEmptyPages} of{' '}
                {sourcePdf.pageCount} {sourcePdf.pageCount === 1 ? 'page' : 'pages'}.
              </span>
            </div>
          )}

          <textarea
            aria-label="Extracted Markdown output"
            rows={15}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Extracts embedded text lines directly in browser memory using PDF.js and formats larger
          headings and list markers into portable Markdown without uploading your PDF. Scanned
          image-only PDFs contain no text layer—run OCR PDF on scanned pages first.
        </p>
      </div>
    </div>
  );
}
