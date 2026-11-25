import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  GripVertical,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  inspectPdfBytes,
  isPdfFileCandidate,
  MAX_MERGE_FILE_BYTES,
  MAX_MERGE_FILES,
  MAX_MERGE_TOTAL_BYTES,
  mergePdfBuffers,
  sanitizePdfOutputFilename,
} from '@/src/utils/pdfMerge';

interface QueuedPdfItem {
  id: string;
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface MergedPdfOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
  sourceFileCount: number;
}

export function MergePdfTool() {
  const [pdfs, setPdfs] = useState<QueuedPdfItem[]>([]);
  const [outputName, setOutputName] = useState<string>('toolmitra-merged');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mergedOutput, setMergedOutput] = useState<MergedPdfOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mergedUrlRef = useRef<string | null>(null);

  const clearMergedOutput = () => {
    if (mergedUrlRef.current) {
      URL.revokeObjectURL(mergedUrlRef.current);
      mergedUrlRef.current = null;
    }
    setMergedOutput(null);
  };

  useEffect(() => {
    return () => {
      if (mergedUrlRef.current) {
        URL.revokeObjectURL(mergedUrlRef.current);
        mergedUrlRef.current = null;
      }
    };
  }, []);

  const totalSizeBytes = useMemo(
    () => pdfs.reduce((sum, item) => sum + item.size, 0),
    [pdfs],
  );
  const totalPages = useMemo(
    () => pdfs.reduce((sum, item) => sum + item.pageCount, 0),
    [pdfs],
  );

  const addPdfFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setErrorMessage(null);
    clearMergedOutput();

    const incoming = Array.from(fileList);
    const remainingSlots = MAX_MERGE_FILES - pdfs.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`Maximum ${MAX_MERGE_FILES} PDF files allowed per merge.`);
      return;
    }

    setIsReadingFiles(true);
    setStatusMessage(`Validating ${incoming.length} ${incoming.length === 1 ? 'file' : 'files'}...`);

    const rejected: string[] = [];
    const accepted: QueuedPdfItem[] = [];
    let runningTotalBytes = totalSizeBytes;

    try {
      for (const file of incoming) {
        if (accepted.length >= remainingSlots) {
          rejected.push(`${file.name} (exceeds ${MAX_MERGE_FILES}-file limit)`);
          continue;
        }
        if (!isPdfFileCandidate(file)) {
          rejected.push(`${file.name} (only .pdf files are supported)`);
          continue;
        }
        if (file.size === 0) {
          rejected.push(`${file.name} (file is empty)`);
          continue;
        }
        if (file.size > MAX_MERGE_FILE_BYTES) {
          rejected.push(`${file.name} (exceeds 50 MB per-file limit)`);
          continue;
        }
        if (runningTotalBytes + file.size > MAX_MERGE_TOTAL_BYTES) {
          rejected.push(`${file.name} (exceeds 150 MB total browser memory limit)`);
          continue;
        }

        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const pageCount = await inspectPdfBytes(bytes, file.name);
          runningTotalBytes += file.size;
          accepted.push({
            id: `${file.name}-${crypto.randomUUID()}`,
            file,
            bytes,
            size: file.size,
            pageCount,
          });
        } catch (err) {
          rejected.push(
            err instanceof Error ? err.message : `${file.name} (unable to read PDF)`,
          );
        }
      }

      if (rejected.length > 0) {
        setErrorMessage(`Skipped ${rejected.length} file(s): ${rejected.join('; ')}`);
      }
      if (accepted.length > 0) {
        setPdfs((prev) => [...prev, ...accepted]);
      }
    } finally {
      setIsReadingFiles(false);
      setStatusMessage(null);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void addPdfFiles(e.target.files);
    e.target.value = '';
  };

  const handleDropZoneDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    void addPdfFiles(e.dataTransfer.files);
  };

  const reorderItems = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= pdfs.length) return;
    clearMergedOutput();
    setErrorMessage(null);
    setPdfs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removePdf = (id: string) => {
    clearMergedOutput();
    setErrorMessage(null);
    setPdfs((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    clearMergedOutput();
    setPdfs([]);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleMergePdfs = async () => {
    if (pdfs.length < 2) {
      setErrorMessage('Add at least 2 PDF files to merge them into a single document.');
      return;
    }

    clearMergedOutput();
    setErrorMessage(null);
    setIsMerging(true);
    setStatusMessage('Loading PDF engine...');

    try {
      const result = await mergePdfBuffers(
        pdfs.map((item) => ({ name: item.file.name, bytes: item.bytes })),
        (current, total, name) => {
          setStatusMessage(`Merging file ${current} of ${total}: ${name}`);
        },
      );

      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      mergedUrlRef.current = url;

      setMergedOutput({
        url,
        filename: sanitizePdfOutputFilename(outputName),
        size: blob.size,
        pageCount: result.pageCount,
        sourceFileCount: pdfs.length,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to merge PDFs. Please check your files and try again.',
      );
      setStatusMessage(null);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Output Options & Summary Strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="merge-pdf-filename"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Merged Output Filename
            </label>
            <div className="mt-1.5 flex items-center">
              <input
                id="merge-pdf-filename"
                type="text"
                value={outputName}
                onChange={(e) => {
                  setOutputName(e.target.value);
                  clearMergedOutput();
                }}
                placeholder="toolmitra-merged"
                className="h-10 w-full rounded-l-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <span className="inline-flex h-10 items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                .pdf
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Queued Files</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {pdfs.length} / {MAX_MERGE_FILES}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Pages &amp; Size
            </p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {totalPages} {totalPages === 1 ? 'page' : 'pages'} · {formatBytes(totalSizeBytes)}
            </p>
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFiles(true);
        }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={handleDropZoneDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDraggingFiles
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="merge-pdf-input"
          type="file"
          multiple
          accept="application/pdf,.pdf"
          onChange={handleFileInputChange}
          className="sr-only"
        />
        <FilePlus2
          className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drop PDF files here to combine them into one document
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to {MAX_MERGE_FILES} PDFs · Max 50 MB per file (150 MB combined) · Merged locally in
          your browser
        </p>
        <button
          type="button"
          disabled={isReadingFiles || isMerging}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {isReadingFiles ? 'Reading PDFs...' : 'Select PDF Files'}
        </button>
      </div>

      {/* Processing Status */}
      {(isReadingFiles || isMerging || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Processing PDFs in your browser...'}</p>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Ready / Download Card */}
      {mergedOutput && (
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
                Merged PDF ready: {mergedOutput.filename}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                Combined {mergedOutput.sourceFileCount} PDFs into {mergedOutput.pageCount}{' '}
                {mergedOutput.pageCount === 1 ? 'page' : 'pages'} ({formatBytes(mergedOutput.size)}
                ) locally on your device.
              </p>
            </div>
          </div>

          <a
            href={mergedOutput.url}
            download={mergedOutput.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Merged PDF</span>
          </a>
        </div>
      )}

      {/* Queue List & Merge Action */}
      {pdfs.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Merge Order ({pdfs.length} {pdfs.length === 1 ? 'file' : 'files'})
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drag rows or use the arrow buttons to set the exact page sequence.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isMerging || isReadingFiles}
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Clear all</span>
              </button>

              <button
                type="button"
                disabled={isMerging || isReadingFiles || pdfs.length < 2}
                onClick={() => void handleMergePdfs()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isMerging ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isMerging ? 'Merging PDFs...' : 'Merge PDFs'}</span>
              </button>
            </div>
          </div>

          {pdfs.length === 1 && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Add at least one more PDF file to enable merging.
            </p>
          )}

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {pdfs.map((item, idx) => {
              const isRowDropTarget = dragOverIndex === idx && draggedIndex !== idx;
              return (
                <div
                  key={item.id}
                  draggable={!isMerging}
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      setDragOverIndex(idx);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === idx) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null) {
                      reorderItems(draggedIndex, idx);
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`flex flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center ${
                    isRowDropTarget
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="hidden cursor-grab text-slate-400 sm:inline-flex dark:text-slate-500"
                      aria-hidden="true"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="w-6 shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                      {idx + 1}.
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-400">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.file.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                        {formatBytes(item.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0 || isMerging}
                      onClick={() => reorderItems(idx, idx - 1)}
                      aria-label={`Move ${item.file.name} up`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === pdfs.length - 1 || isMerging}
                      onClick={() => reorderItems(idx, idx + 1)}
                      aria-label={`Move ${item.file.name} down`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isMerging}
                      onClick={() => removePdf(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:opacity-40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Local Privacy Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Your PDF documents never leave your device. ToolMitra combines pages strictly inside your
          browser memory without uploading files to any server or storing copies. Password-protected
          PDFs must be unlocked before merging.
        </p>
      </div>
    </div>
  );
}
