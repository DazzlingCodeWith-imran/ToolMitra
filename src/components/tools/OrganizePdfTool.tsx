import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CopyPlus,
  Download,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { MAX_ORGANIZE_FILE_BYTES, organizePdfPages } from '@/src/utils/pdfOrganize';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import { normalizeRotationAngle, type RotationAngle } from '@/src/utils/pdfRotate';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

const MAX_THUMB_PAGES = 40;

interface OrganizeCardItem {
  uid: string;
  sourcePageIndex: number; // 0-based
  originalPageNumber: number; // 1-based
  rotationDelta: RotationAngle;
}

interface LoadedSource {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface OrganizedOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
}

export function OrganizePdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedSource | null>(null);
  const [cards, setCards] = useState<OrganizeCardItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [isRenderingThumbs, setIsRenderingThumbs] = useState(false);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<OrganizedOutput | null>(null);

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

  const clearThumbs = () => {
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

  useEffect(() => {
    if (!sourcePdf) {
      clearThumbs();
      return;
    }

    let cancelled = false;
    const renderThumbs = async () => {
      clearThumbs();
      const count = Math.min(sourcePdf.pageCount, MAX_THUMB_PAGES);
      if (count === 0) return;

      setIsRenderingThumbs(true);
      let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handle = await openPdfJsDocument(sourcePdf.bytes);
        for (let p = 1; p <= count; p++) {
          if (cancelled) break;
          const rendered = await renderPdfPageToJpegBlob(handle.doc, p, 0.35, 0.7);
          if (cancelled) break;
          const url = URL.createObjectURL(rendered.blob);
          thumbUrlsRef.current.push(url);
          setThumbnails((prev) => ({ ...prev, [p]: url }));
        }
      } catch {
        // Progressive enhancement
      } finally {
        if (handle) await handle.dispose();
        if (!cancelled) setIsRenderingThumbs(false);
      }
    };

    void renderThumbs();
    return () => {
      cancelled = true;
    };
  }, [sourcePdf]);

  const resetCardsFromSource = (pageCount: number) => {
    setCards(
      Array.from({ length: pageCount }, (_, i) => ({
        uid: `page-${i + 1}-${crypto.randomUUID()}`,
        sourcePageIndex: i,
        originalPageNumber: i + 1,
        rotationDelta: 0,
      })),
    );
  };

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
    if (file.size > MAX_ORGANIZE_FILE_BYTES) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      resetCardsFromSource(pageCount);
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setCards([]);
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

  const handleDropZone = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    void handleFileLoad(e.dataTransfer.files);
  };

  const moveCard = (from: number, to: number) => {
    if (from === to || to < 0 || to >= cards.length) return;
    clearOutput();
    setCards((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const rotateCard = (idx: number, delta: number) => {
    clearOutput();
    setCards((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, rotationDelta: normalizeRotationAngle(c.rotationDelta + delta) } : c,
      ),
    );
  };

  const duplicateCard = (idx: number) => {
    clearOutput();
    setCards((prev) => {
      const target = prev[idx];
      const copy: OrganizeCardItem = {
        ...target,
        uid: `dup-${target.originalPageNumber}-${crypto.randomUUID()}`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeCard = (uid: string) => {
    clearOutput();
    setCards((prev) => prev.filter((c) => c.uid !== uid));
  };

  const handleSave = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (cards.length === 0) {
      setErrorMessage('Keep at least one page before exporting.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsSaving(true);
    setStatusMessage('Rebuilding organized PDF...');

    try {
      const result = await organizePdfPages(
        sourcePdf.bytes,
        cards.map((c) => ({
          sourcePageIndex: c.sourcePageIndex,
          rotationDelta: c.rotationDelta,
        })),
        (msg) => setStatusMessage(msg),
      );

      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      const base = sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra');
      setOutput({
        url,
        filename: `${base}-organized.pdf`,
        size: blob.size,
        pageCount: result.pageCount,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save organized PDF.',
      );
      setStatusMessage(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={handleDropZone}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDraggingFile
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="organize-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleInputChange}
          className="sr-only"
        />
        <FileUp className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {sourcePdf
            ? `Loaded: ${sourcePdf.file.name} (${sourcePdf.pageCount} original ${
                sourcePdf.pageCount === 1 ? 'page' : 'pages'
              })`
            : 'Drop a PDF file here to reorder, delete, duplicate, or rotate pages'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Processed locally in your browser
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isSaving}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isSaving}
              onClick={() => {
                clearOutput();
                clearThumbs();
                setSourcePdf(null);
                setCards([]);
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

      {(isLoadingFile || isSaving || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Processing PDF...'}</p>
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
                Organized PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                {output.pageCount} {output.pageCount === 1 ? 'page' : 'pages'} ·{' '}
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
            <span>Download Organized PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Page Sequence ({cards.length} {cards.length === 1 ? 'page' : 'pages'})
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drag thumbnails or use the arrow buttons to reorder, duplicate, rotate, or delete pages.
                {isRenderingThumbs ? ' Rendering previews...' : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  clearOutput();
                  resetCardsFromSource(sourcePdf.pageCount);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Reset Original Order
              </button>
              <button
                type="button"
                disabled={isSaving || cards.length === 0}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Organized PDF'}</span>
              </button>
            </div>
          </div>

          {cards.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              All pages were removed. Click <strong>Reset Original Order</strong> to restore pages.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {cards.map((card, idx) => {
                const thumbUrl = thumbnails[card.originalPageNumber];
                const isTarget = dragOverIdx === idx && draggedIdx !== idx;
                return (
                  <div
                    key={card.uid}
                    draggable={!isSaving}
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null) moveCard(draggedIdx, idx);
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-3 transition-colors ${
                      isTarget
                        ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
                        : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        #{idx + 1}{' '}
                        <span className="font-normal text-slate-400">
                          (Src {card.originalPageNumber})
                        </span>
                      </span>
                      {card.rotationDelta !== 0 && (
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          +{card.rotationDelta}°
                        </span>
                      )}
                    </div>

                    <div className="flex h-28 cursor-grab items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={`Source page ${card.originalPageNumber}`}
                          style={{ transform: `rotate(${card.rotationDelta}deg)` }}
                          className="max-h-24 max-w-full object-contain transition-transform duration-150"
                        />
                      ) : (
                        <FileText
                          style={{ transform: `rotate(${card.rotationDelta}deg)` }}
                          className="h-8 w-8 text-slate-400 transition-transform duration-150 dark:text-slate-500"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="mt-2.5 grid grid-cols-5 gap-1">
                      <button
                        type="button"
                        disabled={idx === 0 || isSaving}
                        onClick={() => moveCard(idx, idx - 1)}
                        aria-label={`Move page ${idx + 1} earlier`}
                        className="inline-flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === cards.length - 1 || isSaving}
                        onClick={() => moveCard(idx, idx + 1)}
                        aria-label={`Move page ${idx + 1} later`}
                        className="inline-flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => rotateCard(idx, -90)}
                        aria-label={`Rotate page ${idx + 1} left`}
                        className="inline-flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => duplicateCard(idx)}
                        aria-label={`Duplicate page ${idx + 1}`}
                        className="inline-flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => removeCard(card.uid)}
                        aria-label={`Delete page ${idx + 1}`}
                        className="inline-flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p>
          All page reordering, deletion, rotation, and duplication run strictly inside your browser
          memory with zero server uploads.
        </p>
      </div>
    </div>
  );
}
