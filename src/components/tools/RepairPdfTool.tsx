import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { MAX_REPAIR_FILE_BYTES, repairPdfBytes } from '@/src/utils/pdfRepair';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface RepairedOutput {
  url: string;
  filename: string;
  originalSize: number;
  repairedSize: number;
  recoveredPages: number;
  skippedPages: number;
  notes: string[];
}

export function RepairPdfTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<RepairedOutput | null>(null);

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

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setSelectedFile(null);
      setErrorMessage(`"${file.name}" does not have a .pdf extension or MIME type.`);
      return;
    }
    if (file.size === 0) {
      setSelectedFile(null);
      setErrorMessage(`"${file.name}" is empty (0 bytes) and cannot be repaired.`);
      return;
    }
    if (file.size > MAX_REPAIR_FILE_BYTES) {
      setSelectedFile(null);
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setSelectedFile(file);
  };

  const handleRepair = async () => {
    if (!selectedFile) {
      setErrorMessage('Select a damaged or malformed PDF file first.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsRepairing(true);
    setStatusMessage(`Analyzing "${selectedFile.name}"...`);

    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const res = await repairPdfBytes(bytes, (msg) => setStatusMessage(msg));

      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      setOutput({
        url,
        filename: `${sanitizeBasePdfName(selectedFile.name, 'toolmitra')}-repaired.pdf`,
        originalSize: selectedFile.size,
        repairedSize: blob.size,
        recoveredPages: res.recoveredPages,
        skippedPages: res.skippedPages,
        notes: res.notes,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to repair this PDF in the browser.',
      );
      setStatusMessage(null);
    } finally {
      setIsRepairing(false);
    }
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
          handleFileSelect(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="repair-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            handleFileSelect(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <FileUp className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {selectedFile
            ? `Ready to inspect: ${selectedFile.name} (${formatBytes(selectedFile.size)})`
            : 'Drop a damaged or non-opening PDF file here to attempt browser repair'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to 50 MB · Rebuilds cross-reference tables, strips leading garbage bytes, and rescues intact pages locally
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isRepairing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {selectedFile ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {selectedFile && (
            <>
              <button
                type="button"
                disabled={isRepairing}
                onClick={() => void handleRepair()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isRepairing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isRepairing ? 'Repairing PDF...' : 'Repair PDF'}</span>
              </button>
              <button
                type="button"
                disabled={isRepairing}
                onClick={() => {
                  clearOutput();
                  setSelectedFile(null);
                  setErrorMessage(null);
                  setStatusMessage(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {(isRepairing || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Repairing PDF structure...'}</p>
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
          className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/40"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  Repaired PDF ready: {output.filename}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                  Recovered {output.recoveredPages} {output.recoveredPages === 1 ? 'page' : 'pages'}
                  {output.skippedPages > 0 ? ` (${output.skippedPages} unreadable skipped)` : ''} ·{' '}
                  {formatBytes(output.repairedSize)}
                </p>
              </div>
            </div>

            <a
              href={output.url}
              download={output.filename}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download Repaired PDF</span>
            </a>
          </div>

          <ul className="space-y-1 border-t border-emerald-200/80 pt-3 text-xs text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-200">
            {output.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p>
          Browser-side structural repair fixes offset <code className="font-mono">%PDF-</code>{' '}
          headers, rebuilds cross-reference tables, and extracts readable pages without uploading
          files. Severely truncated or hardware-corrupted files with destroyed page streams may not
          be recoverable.
        </p>
      </div>
    </div>
  );
}
