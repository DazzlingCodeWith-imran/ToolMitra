import {
  AlertCircle,
  CheckCircle2,
  Download,
  EyeOff,
  FileUp,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import {
  findTextRedactionBoxesInPdf,
  MAX_REDACT_FILE_BYTES,
  rebuildPdfWithRedactedBitmaps,
  type RedactedPageBitmap,
  type RedactionBox,
} from '@/src/utils/pdfRedact';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedRedactPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface RedactedOutput {
  url: string;
  filename: string;
  size: number;
  redactedPages: number;
  totalBoxes: number;
}

export function RedactPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedRedactPdf | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [boxX, setBoxX] = useState(14);
  const [boxY, setBoxY] = useState(22);
  const [boxW, setBoxW] = useState(30);
  const [boxH, setBoxH] = useState(5);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRedacting, setIsRedacting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<RedactedOutput | null>(null);

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
    const render = async () => {
      let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handle = await openPdfJsDocument(sourcePdf.bytes);
        const safePage = Math.min(Math.max(1, activePage), handle.doc.numPages);
        const rendered = await renderPdfPageToJpegBlob(handle.doc, safePage, 1.2, 0.88);
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(rendered.blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        // Fallback cleanly
      } finally {
        if (handle) await handle.dispose();
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [sourcePdf, activePage]);

  const handleLoadPdf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_REDACT_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 50 MB.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setActivePage(1);
      setBoxes([]);
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleFindTextMatches = async () => {
    if (!sourcePdf) return;
    const clean = searchTerm.trim();
    if (!clean) {
      setErrorMessage('Enter a word, email, phone number, or phrase to search for redaction.');
      return;
    }

    setErrorMessage(null);
    setIsSearching(true);
    setStatusMessage(`Scanning all pages for "${clean}"...`);

    try {
      const found = await findTextRedactionBoxesInPdf(sourcePdf.bytes, clean, false);
      if (found.length === 0) {
        setErrorMessage(
          `No selectable text matches found for "${clean}". For scanned PDFs, draw manual black boxes over the page preview.`,
        );
      } else {
        setBoxes((prev) => [...prev, ...found]);
        setActivePage(found[0].pageNumber);
        clearOutput();
      }
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to scan PDF text.');
      setStatusMessage(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddManualBox = () => {
    if (!sourcePdf) return;
    clearOutput();
    setErrorMessage(null);
    setBoxes((prev) => [
      ...prev,
      {
        id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageNumber: activePage,
        xPercent: boxX,
        yPercent: boxY,
        widthPercent: boxW,
        heightPercent: boxH,
        label: 'Manual region',
      },
    ]);
  };

  const handleApplyRedactions = async () => {
    if (!sourcePdf) return;
    if (boxes.length === 0) {
      setErrorMessage('Mark at least one keyword match or manual region before redacting.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsRedacting(true);
    setStatusMessage('Permanently flattening redacted pages...');

    let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
    try {
      const boxesByPage = new Map<number, RedactionBox[]>();
      for (const b of boxes) {
        const list = boxesByPage.get(b.pageNumber) ?? [];
        list.push(b);
        boxesByPage.set(b.pageNumber, list);
      }

      handle = await openPdfJsDocument(sourcePdf.bytes);
      const flattenedPages: RedactedPageBitmap[] = [];

      for (const [pageNumber, pageBoxes] of boxesByPage.entries()) {
        setStatusMessage(`Flattening & scrubbing page ${pageNumber}...`);
        const page = await handle.doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Browser Canvas 2D context unavailable.');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;

        // Permanently burn opaque #000000 blocks over pixels; no underlying vector/text remains
        ctx.fillStyle = '#000000';
        for (const box of pageBoxes) {
          const rx = (box.xPercent / 100) * canvas.width;
          const ry = (box.yPercent / 100) * canvas.height;
          const rw = (box.widthPercent / 100) * canvas.width;
          const rh = (box.heightPercent / 100) * canvas.height;
          ctx.fillRect(rx, ry, rw, rh);
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error(`Could not encode page ${pageNumber}.`))),
            'image/jpeg',
            0.9,
          );
        });
        flattenedPages.push({
          pageNumber,
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mimeType: 'image/jpeg',
        });

        canvas.width = 0;
        canvas.height = 0;
      }

      await handle.dispose();
      handle = null;

      const built = await rebuildPdfWithRedactedBitmaps(
        sourcePdf.bytes,
        flattenedPages,
        (msg) => setStatusMessage(msg),
      );
      const outBlob = new Blob([built.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(outBlob);
      outputUrlRef.current = url;

      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-redacted.pdf`,
        size: outBlob.size,
        redactedPages: built.redactedPageCount,
        totalBoxes: boxes.length,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to apply permanent redactions.');
      setStatusMessage(null);
    } finally {
      if (handle) await handle.dispose();
      setIsRedacting(false);
    }
  };

  const activePageBoxes = boxes.filter((b) => b.pageNumber === activePage);

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
          id="redact-pdf-input"
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
            : 'Drop a PDF file here to permanently redact sensitive text or regions'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Redacted pages are permanently flattened
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isRedacting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isRedacting}
              onClick={() => {
                clearOutput();
                setSourcePdf(null);
                setBoxes([]);
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

      {(isLoadingFile || isSearching || isRedacting || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Applying permanent redaction...'}</p>
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
                Redacted PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                {output.totalBoxes} redaction{output.totalBoxes === 1 ? '' : 's'} flattened across{' '}
                {output.redactedPages} {output.redactedPages === 1 ? 'page' : 'pages'} ·{' '}
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
            <span>Download Redacted PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            {/* Search-and-mark */}
            <div className="space-y-2">
              <label
                htmlFor="redact-search-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Auto-Find Sensitive Text (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  id="redact-search-input"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Email, SSN, account number..."
                  className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={isSearching || isRedacting}
                  onClick={() => void handleFindTextMatches()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mark Matches</span>
                </button>
              </div>
            </div>

            {/* Manual box placement */}
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Manual Redaction Region (Click preview to position)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-500">X: {boxX}%</span>
                  <input
                    type="range"
                    aria-label="Redaction X percent"
                    min={0}
                    max={92}
                    value={boxX}
                    onChange={(e) => setBoxX(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Y: {boxY}%</span>
                  <input
                    type="range"
                    aria-label="Redaction Y percent"
                    min={0}
                    max={94}
                    value={boxY}
                    onChange={(e) => setBoxY(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Width: {boxW}%</span>
                  <input
                    type="range"
                    aria-label="Redaction width percent"
                    min={3}
                    max={95}
                    value={boxW}
                    onChange={(e) => setBoxW(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Height: {boxH}%</span>
                  <input
                    type="range"
                    aria-label="Redaction height percent"
                    min={2}
                    max={40}
                    value={boxH}
                    onChange={(e) => setBoxH(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddManualBox}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Mark Box on Page {activePage}</span>
              </button>
            </div>

            {/* Queued redactions */}
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Marked Redactions ({boxes.length})
                </span>
                {boxes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBoxes([]);
                      clearOutput();
                    }}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {boxes.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Search for sensitive phrases above or click the page preview and add boxes.
                </p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {boxes.map((box) => (
                    <li
                      key={box.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => setActivePage(box.pageNumber)}
                        className="min-w-0 flex-1 truncate text-left text-slate-700 hover:text-blue-600 dark:text-slate-300"
                      >
                        <span className="font-mono font-semibold text-slate-500">
                          P{box.pageNumber}
                        </span>{' '}
                        · {box.label || 'Region'} ({Math.round(box.widthPercent)}%×
                        {Math.round(box.heightPercent)}%)
                      </button>
                      <button
                        type="button"
                        aria-label="Remove redaction mark"
                        onClick={() => {
                          setBoxes((prev) => prev.filter((item) => item.id !== box.id));
                          clearOutput();
                        }}
                        className="rounded p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              disabled={boxes.length === 0 || isRedacting || isLoadingFile}
              onClick={() => void handleApplyRedactions()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {isRedacting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isRedacting ? 'Flattening Redactions...' : 'Apply Permanent Redactions'}
              </span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Redaction Preview (Page {activePage})
              </h2>
              {sourcePdf.pageCount > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={activePage <= 1}
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Prev
                  </button>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {activePage}/{sourcePdf.pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={activePage >= sourcePdf.pageCount}
                    onClick={() => setActivePage((p) => Math.min(sourcePdf.pageCount, p + 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-[340px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              {previewUrl ? (
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    setBoxX(Math.max(0, Math.min(92, x)));
                    setBoxY(Math.max(0, Math.min(94, y)));
                  }}
                  className="relative inline-block cursor-crosshair overflow-hidden rounded border border-slate-300 bg-white shadow-xs"
                >
                  <img
                    src={previewUrl}
                    alt={`Page ${activePage} redaction preview`}
                    className="block max-h-[420px] w-auto select-none object-contain"
                  />

                  {activePageBoxes.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        left: `${b.xPercent}%`,
                        top: `${b.yPercent}%`,
                        width: `${b.widthPercent}%`,
                        height: `${b.heightPercent}%`,
                      }}
                      className="pointer-events-none absolute border border-red-500 bg-black/85"
                    />
                  ))}

                  <div
                    style={{
                      left: `${boxX}%`,
                      top: `${boxY}%`,
                      width: `${boxW}%`,
                      height: `${boxH}%`,
                    }}
                    className="pointer-events-none absolute border-2 border-dashed border-red-600 bg-red-500/20"
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rendering page preview...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          True permanent redaction: pages with marked redactions are rasterized into flat images
          with solid black pixels and stripped document metadata, destroying underlying text on
          those pages so redacted information cannot be copied or selected.
        </p>
      </div>
    </div>
  );
}
