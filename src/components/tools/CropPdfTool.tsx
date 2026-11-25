import {
  AlertCircle,
  CheckCircle2,
  Crop,
  Download,
  FileUp,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  cropPdfPages,
  MAX_CROP_FILE_BYTES,
  validateCropMargins,
  type CropPercentMargins,
} from '@/src/utils/pdfCrop';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import { parsePageRanges, sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedCropPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface CroppedOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
  croppedPageCount: number;
}

export function CropPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedCropPdf | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewPage, setPreviewPage] = useState<number>(1);

  const [margins, setMargins] = useState<CropPercentMargins>({
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
  });
  const [targetMode, setTargetMode] = useState<'all' | 'range'>('all');
  const [rangeInput, setRangeInput] = useState<string>('1');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<CroppedOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string>('');
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
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sourcePdf) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
      setPreviewUrl('');
      return;
    }

    let cancelled = false;
    const renderPreview = async () => {
      let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handle = await openPdfJsDocument(sourcePdf.bytes);
        const safePage = Math.min(Math.max(1, previewPage), handle.doc.numPages);
        const rendered = await renderPdfPageToJpegBlob(handle.doc, safePage, 1.0, 0.82);
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(rendered.blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        // Fallback silently if canvas unavailable
      } finally {
        if (handle) await handle.dispose();
      }
    };

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [sourcePdf, previewPage]);

  const handleFileLoad = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file. Please select a .pdf document.`);
      return;
    }
    if (file.size === 0) {
      setErrorMessage(`"${file.name}" is empty (0 bytes).`);
      return;
    }
    if (file.size > MAX_CROP_FILE_BYTES) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setPreviewPage(1);
      setRangeInput(pageCount > 1 ? `1-${pageCount}` : '1');
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(
        err instanceof Error ? err.message : `Could not read "${file.name}" as a valid PDF.`,
      );
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const marginValidationError = useMemo(() => validateCropMargins(margins), [margins]);

  const targetPagePlan = useMemo(() => {
    if (!sourcePdf) return { valid: false, pages: 'all' as const, error: null as string | null };
    if (targetMode === 'all') {
      return { valid: true, pages: 'all' as const, error: null };
    }
    const parsed = parsePageRanges(rangeInput, sourcePdf.pageCount);
    if (!parsed.valid) {
      return { valid: false, pages: [] as number[], error: parsed.error };
    }
    return { valid: true, pages: parsed.flatUniquePages, error: null };
  }, [sourcePdf, targetMode, rangeInput]);

  const handleCrop = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (marginValidationError) {
      setErrorMessage(marginValidationError);
      return;
    }
    if (!targetPagePlan.valid) {
      setErrorMessage(targetPagePlan.error || 'Enter valid pages to crop.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsCropping(true);
    setStatusMessage('Applying PDF crop boxes...');

    try {
      const res = await cropPdfPages(sourcePdf.bytes, margins, targetPagePlan.pages, (msg) =>
        setStatusMessage(msg),
      );
      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-cropped.pdf`,
        size: blob.size,
        pageCount: res.pageCount,
        croppedPageCount: res.croppedPageCount,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to crop PDF pages.');
      setStatusMessage(null);
    } finally {
      setIsCropping(false);
    }
  };

  const updateEdge = (edge: keyof CropPercentMargins, value: number) => {
    clearOutput();
    setMargins((prev) => ({
      ...prev,
      [edge]: Math.max(0, Math.min(45, Number.isFinite(value) ? value : 0)),
    }));
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
          void handleFileLoad(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="crop-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void handleFileLoad(e.target.files);
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
            : 'Drop a PDF file here to trim margins and crop pages'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Non-destructive CropBox framing in browser
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isCropping}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isCropping}
              onClick={() => {
                clearOutput();
                setSourcePdf(null);
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {(isLoadingFile || isCropping || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Cropping PDF...'}</p>
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
                Cropped PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                Cropped {output.croppedPageCount} of {output.pageCount} pages ·{' '}
                {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Cropped PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Controls */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Crop Margin Insets (%)
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      clearOutput();
                      setMargins({ top: pct, right: pct, bottom: pct, left: pct });
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    All {pct}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    clearOutput();
                    setMargins({ top: 0, right: 0, bottom: 0, left: 0 });
                  }}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
                <div key={edge}>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`crop-${edge}`}
                      className="text-sm font-medium capitalize text-slate-900 dark:text-slate-100"
                    >
                      {edge} Margin
                    </label>
                    <span className="font-mono text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {margins[edge]}%
                    </span>
                  </div>
                  <input
                    id={`crop-${edge}`}
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={margins[edge]}
                    onChange={(e) => updateEdge(edge, Number(e.target.value))}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <label
                htmlFor="crop-target-mode"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Apply Crop To
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <select
                  id="crop-target-mode"
                  value={targetMode}
                  onChange={(e) => {
                    setTargetMode(e.target.value as 'all' | 'range');
                    clearOutput();
                  }}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="all">All Pages ({sourcePdf.pageCount})</option>
                  <option value="range">Custom Page Range</option>
                </select>
                {targetMode === 'range' && (
                  <input
                    type="text"
                    aria-label="Pages to crop"
                    value={rangeInput}
                    onChange={(e) => {
                      setRangeInput(e.target.value);
                      clearOutput();
                    }}
                    placeholder="e.g., 1-3, 5"
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                )}
              </div>
              {targetMode === 'range' && !targetPagePlan.valid && targetPagePlan.error && (
                <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {targetPagePlan.error}
                </p>
              )}
            </div>

            {marginValidationError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {marginValidationError}
              </p>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                disabled={
                  Boolean(marginValidationError) || !targetPagePlan.valid || isCropping || isLoadingFile
                }
                onClick={() => void handleCrop()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isCropping ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Crop className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isCropping ? 'Cropping...' : 'Crop PDF'}</span>
              </button>
            </div>
          </div>

          {/* Live Crop Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Crop Boundary Preview
              </h2>
              {sourcePdf.pageCount > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Prev
                  </button>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {previewPage}/{sourcePdf.pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={previewPage >= sourcePdf.pageCount}
                    onClick={() => setPreviewPage((p) => Math.min(sourcePdf.pageCount, p + 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              {previewUrl ? (
                <div className="relative inline-block overflow-hidden rounded border border-slate-300 bg-white shadow-xs">
                  <img
                    src={previewUrl}
                    alt={`Page ${previewPage} crop preview`}
                    className="block max-h-72 w-auto object-contain"
                  />
                  {/* Shaded trimmed margins */}
                  <div
                    aria-hidden="true"
                    style={{
                      top: `${margins.top}%`,
                      right: `${margins.right}%`,
                      bottom: `${margins.bottom}%`,
                      left: `${margins.left}%`,
                      boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.35)',
                    }}
                    className="pointer-events-none absolute border-2 border-dashed border-blue-500"
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading page preview...</p>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Dashed blue box indicates the remaining visible area after cropping.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p>
          Pages are cropped locally using PDF CropBox bounds in your browser without uploading files.
        </p>
      </div>
    </div>
  );
}
