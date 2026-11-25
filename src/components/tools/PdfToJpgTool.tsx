import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileUp,
  Images,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { parsePageRanges, sanitizeBasePdfName } from '@/src/utils/pdfSplit';
import {
  convertPdfPagesToJpg,
  createJpgZipBlob,
  MAX_PDF_TO_JPG_BYTES,
} from '@/src/utils/pdfToJpg';

type ScalePreset = 1 | 2 | 3;
type PageSelectionMode = 'all' | 'range';

interface LoadedPdfDoc {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface JpgPreviewOutput {
  pageNumber: number;
  filename: string;
  widthPx: number;
  heightPx: number;
  size: number;
  url: string;
  bytes: Uint8Array;
}

export function PdfToJpgTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedPdfDoc | null>(null);
  const [scalePreset, setScalePreset] = useState<ScalePreset>(2);
  const [quality, setQuality] = useState<number>(90);
  const [pageMode, setPageMode] = useState<PageSelectionMode>('all');
  const [rangeInput, setRangeInput] = useState<string>('1');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<JpgPreviewOutput[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlsRef = useRef<string[]>([]);

  const revokeOutputs = () => {
    for (const url of outputUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    outputUrlsRef.current = [];
    setOutputs([]);
  };

  useEffect(() => {
    return () => {
      for (const url of outputUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      outputUrlsRef.current = [];
    };
  }, []);

  const handleFileLoad = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setErrorMessage(null);
    revokeOutputs();

    if (fileList.length > 1) {
      setErrorMessage('PDF to JPG converts one document at a time. Loaded the first selected file.');
    }

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file. Please select a .pdf document.`);
      return;
    }
    if (file.size === 0) {
      setErrorMessage(`"${file.name}" is empty (0 bytes).`);
      return;
    }
    if (file.size > MAX_PDF_TO_JPG_BYTES) {
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
      setRangeInput(pageCount > 1 ? `1-${Math.min(3, pageCount)}` : '1');
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
    revokeOutputs();
    setSourcePdf(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const pagePlan = useMemo(() => {
    if (!sourcePdf) return { valid: false, pages: [] as number[], error: null as string | null };

    if (pageMode === 'all') {
      return {
        valid: true,
        pages: Array.from({ length: sourcePdf.pageCount }, (_, i) => i + 1),
        error: null,
      };
    }

    const parsed = parsePageRanges(rangeInput, sourcePdf.pageCount);
    if (!parsed.valid) {
      return { valid: false, pages: [], error: parsed.error };
    }
    return { valid: true, pages: parsed.flatUniquePages, error: null };
  }, [sourcePdf, pageMode, rangeInput]);

  const handleConvert = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (!pagePlan.valid || pagePlan.pages.length === 0) {
      setErrorMessage(pagePlan.error || 'Select valid pages to convert.');
      return;
    }

    revokeOutputs();
    setErrorMessage(null);
    setIsConverting(true);
    setStatusMessage('Loading PDF rendering engine...');

    try {
      const renderedPages = await convertPdfPagesToJpg(
        sourcePdf.bytes,
        pagePlan.pages,
        sourcePdf.file.name,
        { scale: scalePreset, quality: quality / 100 },
        (current, total, pageNum) => {
          setStatusMessage(`Rendering page ${pageNum} (${current} of ${total})...`);
        },
      );

      const createdUrls: string[] = [];
      const previews: JpgPreviewOutput[] = renderedPages.map((item) => {
        const url = URL.createObjectURL(item.blob);
        createdUrls.push(url);
        return {
          pageNumber: item.pageNumber,
          filename: item.filename,
          widthPx: item.widthPx,
          heightPx: item.heightPx,
          size: item.size,
          url,
          bytes: item.bytes,
        };
      });

      outputUrlsRef.current = createdUrls;
      setOutputs(previews);
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to convert PDF pages to JPG.',
      );
      setStatusMessage(null);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (outputs.length === 0 || !sourcePdf) return;
    setIsZipping(true);
    setErrorMessage(null);
    try {
      const zipBlob = await createJpgZipBlob(outputs);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-jpg-pages.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorMessage('Could not create ZIP archive. Try downloading individual JPG files below.');
    } finally {
      setIsZipping(false);
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
          id="pdf-to-jpg-input"
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
            : 'Drop a PDF file here to convert pages into JPG images'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Rendered locally into crisp JPG images
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isConverting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isConverting}
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
      {(isLoadingFile || isConverting || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Rendering PDF pages to JPG...'}</p>
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

      {/* Settings & Convert */}
      {sourcePdf && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label
                htmlFor="pdf-jpg-scale"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Image Resolution
              </label>
              <select
                id="pdf-jpg-scale"
                value={scalePreset}
                onChange={(e) => {
                  setScalePreset(Number(e.target.value) as ScalePreset);
                  revokeOutputs();
                }}
                className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={1}>Standard (1× · Fast)</option>
                <option value={2}>High (2× · Recommended)</option>
                <option value={3}>Print Detail (3× · Large)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pdf-jpg-quality"
                  className="text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  JPG Quality
                </label>
                <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  {quality}%
                </span>
              </div>
              <input
                id="pdf-jpg-quality"
                type="range"
                min={60}
                max={100}
                step={5}
                value={quality}
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  revokeOutputs();
                }}
                className="mt-3.5 w-full accent-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="pdf-jpg-pagemode"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Pages to Export
              </label>
              <select
                id="pdf-jpg-pagemode"
                value={pageMode}
                onChange={(e) => {
                  setPageMode(e.target.value as PageSelectionMode);
                  revokeOutputs();
                }}
                className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">All Pages ({sourcePdf.pageCount})</option>
                <option value="range">Custom Page Range</option>
              </select>
            </div>
          </div>

          {pageMode === 'range' && (
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pdf-jpg-range"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Custom Page Range
                </label>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  Valid pages: 1–{sourcePdf.pageCount}
                </span>
              </div>
              <input
                id="pdf-jpg-range"
                type="text"
                value={rangeInput}
                onChange={(e) => {
                  setRangeInput(e.target.value);
                  revokeOutputs();
                }}
                placeholder="e.g., 1-3, 5"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {!pagePlan.valid && pagePlan.error && (
                <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {pagePlan.error}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {pagePlan.valid
                ? `${pagePlan.pages.length} ${pagePlan.pages.length === 1 ? 'page' : 'pages'} queued for JPG export`
                : 'Adjust page range to continue'}
            </p>
            <button
              type="button"
              disabled={!pagePlan.valid || isConverting || isLoadingFile}
              onClick={() => void handleConvert()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Images className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isConverting ? 'Converting...' : 'Convert to JPG'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Converted JPG Gallery */}
      {outputs.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                Converted {outputs.length} {outputs.length === 1 ? 'page' : 'pages'} to JPG
              </p>
            </div>

            {outputs.length > 1 && (
              <button
                type="button"
                disabled={isZipping}
                onClick={() => void handleDownloadAllZip()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <FileArchive className="h-4 w-4" aria-hidden="true" />
                <span>{isZipping ? 'Creating ZIP...' : 'Download All (ZIP)'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {outputs.map((item) => (
              <div
                key={item.filename}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                    <img
                      src={item.url}
                      alt={`Converted ${item.filename}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.filename}
                  </p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {item.widthPx}×{item.heightPx} px · {formatBytes(item.size)}
                  </p>
                </div>

                <a
                  href={item.url}
                  download={item.filename}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download JPG</span>
                </a>
              </div>
            ))}
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
          PDF pages are rendered and exported to JPG entirely on your device using browser canvas
          rendering—no files are uploaded or stored externally.
        </p>
      </div>
    </div>
  );
}
