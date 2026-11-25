import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import {
  MAX_ROTATE_FILE_BYTES,
  normalizeRotationAngle,
  rotatePdfPages,
  type RotationAngle,
} from '@/src/utils/pdfRotate';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

const MAX_PREVIEW_PAGES = 40;

interface LoadedRotatePdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface RotatedOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
  rotatedPageCount: number;
}

export function RotatePdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedRotatePdf | null>(null);
  const [pageOffsets, setPageOffsets] = useState<RotationAngle[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [isRenderingThumbs, setIsRenderingThumbs] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<RotatedOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const thumbUrlsRef = useRef<string[]>([]);

  const clearOutput = () => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
    setOutput(null);
  };

  const clearThumbnails = () => {
    for (const url of thumbUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    thumbUrlsRef.current = [];
    setThumbnails({});
  };

  useEffect(() => {
    return () => {
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      for (const url of thumbUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  // Render lightweight page thumbnails lazily in the browser for visual orientation check
  useEffect(() => {
    if (!sourcePdf) {
      clearThumbnails();
      return;
    }

    let cancelled = false;
    const renderPreviews = async () => {
      clearThumbnails();
      const countToRender = Math.min(sourcePdf.pageCount, MAX_PREVIEW_PAGES);
      if (countToRender === 0) return;

      setIsRenderingThumbs(true);
      let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handle = await openPdfJsDocument(sourcePdf.bytes);
        for (let pageNumber = 1; pageNumber <= countToRender; pageNumber++) {
          if (cancelled) break;
          const rendered = await renderPdfPageToJpegBlob(handle.doc, pageNumber, 0.35, 0.7);
          if (cancelled) break;
          const url = URL.createObjectURL(rendered.blob);
          thumbUrlsRef.current.push(url);
          setThumbnails((prev) => ({ ...prev, [pageNumber]: url }));
        }
      } catch {
        // Thumbnails are progressive enhancement; lossless pdf-lib rotation still works cleanly
      } finally {
        if (handle) {
          await handle.dispose();
        }
        if (!cancelled) {
          setIsRenderingThumbs(false);
        }
      }
    };

    void renderPreviews();

    return () => {
      cancelled = true;
    };
  }, [sourcePdf]);

  const handleFileLoad = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (fileList.length > 1) {
      setErrorMessage('Rotate PDF handles one document at a time. Loaded the first selected file.');
    }

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file. Please select a .pdf document.`);
      return;
    }
    if (file.size === 0) {
      setErrorMessage(`"${file.name}" is empty (0 bytes).`);
      return;
    }
    if (file.size > MAX_ROTATE_FILE_BYTES) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const pageCount = await inspectPdfBytes(bytes, file.name);

      setSourcePdf({
        file,
        bytes,
        size: file.size,
        pageCount,
      });
      setPageOffsets(Array.from({ length: pageCount }, () => 0));
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setPageOffsets([]);
      setErrorMessage(
        err instanceof Error ? err.message : `Could not read "${file.name}" as a valid PDF.`,
      );
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFileLoad(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileLoad(e.dataTransfer.files);
  };

  const handleClear = () => {
    clearOutput();
    clearThumbnails();
    setSourcePdf(null);
    setPageOffsets([]);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const rotateAll = (delta: number) => {
    clearOutput();
    setErrorMessage(null);
    setPageOffsets((prev) => prev.map((angle) => normalizeRotationAngle(angle + delta)));
  };

  const resetAllRotations = () => {
    clearOutput();
    setErrorMessage(null);
    setPageOffsets((prev) => prev.map(() => 0));
  };

  const rotateSinglePage = (index: number, delta: number) => {
    clearOutput();
    setErrorMessage(null);
    setPageOffsets((prev) =>
      prev.map((angle, idx) => (idx === index ? normalizeRotationAngle(angle + delta) : angle)),
    );
  };

  const rotatedCount = useMemo(
    () => pageOffsets.filter((offset) => offset !== 0).length,
    [pageOffsets],
  );

  const handleApplyRotation = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (rotatedCount === 0) {
      setErrorMessage('Rotate at least one page (left, right, or 180°) before saving.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsApplying(true);
    setStatusMessage('Applying lossless page rotation...');

    try {
      const res = await rotatePdfPages(sourcePdf.bytes, pageOffsets, (msg) =>
        setStatusMessage(msg),
      );

      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      const base = sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra');
      setOutput({
        url,
        filename: `${base}-rotated.pdf`,
        size: blob.size,
        pageCount: res.pageCount,
        rotatedPageCount: res.rotatedPageCount,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to rotate PDF. Please check the file.',
      );
      setStatusMessage(null);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="rotate-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleInputChange}
          className="sr-only"
        />
        <FileUp
          className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {sourcePdf
            ? `Loaded: ${sourcePdf.file.name} (${sourcePdf.pageCount} ${
                sourcePdf.pageCount === 1 ? 'page' : 'pages'
              })`
            : 'Drop a PDF file here to rotate all or individual pages'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Lossless rotation up to 50 MB · Preserves text, fonts, and vectors locally
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isApplying}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isApplying}
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {(isLoadingFile || isApplying || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Processing PDF locally...'}</p>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Download Output */}
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
                Rotated PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                Updated {output.rotatedPageCount} of {output.pageCount}{' '}
                {output.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Rotated PDF</span>
          </a>
        </div>
      )}

      {/* Bulk Toolbar & Page Grid */}
      {sourcePdf && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Page Rotation Controls
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {rotatedCount} of {sourcePdf.pageCount}{' '}
                {sourcePdf.pageCount === 1 ? 'page' : 'pages'} modified
                {isRenderingThumbs ? ' · Generating previews...' : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isApplying}
                onClick={() => rotateAll(-90)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All −90°</span>
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={() => rotateAll(90)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All +90°</span>
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={() => rotateAll(180)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>Flip All 180°</span>
              </button>
              <button
                type="button"
                disabled={isApplying || rotatedCount === 0}
                onClick={resetAllRotations}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <span>Reset</span>
              </button>
              <button
                type="button"
                disabled={isApplying || rotatedCount === 0}
                onClick={() => void handleApplyRotation()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isApplying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isApplying ? 'Saving PDF...' : 'Apply Rotation'}</span>
              </button>
            </div>
          </div>

          {sourcePdf.pageCount > MAX_PREVIEW_PAGES && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing visual thumbnails for the first {MAX_PREVIEW_PAGES} pages to keep browser
              memory fast. Rotation controls still apply to all {sourcePdf.pageCount} pages.
            </p>
          )}

          {/* Page Cards Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pageOffsets.map((offset, idx) => {
              const pageNumber = idx + 1;
              const thumbUrl = thumbnails[pageNumber];
              return (
                <div
                  key={pageNumber}
                  className={`flex flex-col justify-between rounded-xl border p-3 transition-colors ${
                    offset !== 0
                      ? 'border-blue-500/70 bg-blue-50/40 dark:border-blue-400/60 dark:bg-blue-950/20'
                      : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      Page {pageNumber}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold tabular-nums ${
                        offset !== 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {offset === 0 ? '0°' : `+${offset}°`}
                    </span>
                  </div>

                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Page ${pageNumber} preview`}
                        style={{ transform: `rotate(${offset}deg)` }}
                        className="max-h-24 max-w-full object-contain transition-transform duration-150"
                      />
                    ) : (
                      <div
                        style={{ transform: `rotate(${offset}deg)` }}
                        className="flex flex-col items-center text-slate-400 transition-transform duration-150 dark:text-slate-500"
                      >
                        <FileText className="h-8 w-8" aria-hidden="true" />
                        <span className="mt-1 font-mono text-[10px]">P.{pageNumber}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isApplying}
                      onClick={() => rotateSinglePage(idx, -90)}
                      aria-label={`Rotate page ${pageNumber} 90 degrees left`}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>−90°</span>
                    </button>
                    <button
                      type="button"
                      disabled={isApplying}
                      onClick={() => rotateSinglePage(idx, 90)}
                      aria-label={`Rotate page ${pageNumber} 90 degrees right`}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>+90°</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Page rotations are saved losslessly inside your browser memory without re-compressing text
          or uploading documents to any server.
        </p>
      </div>
    </div>
  );
}
