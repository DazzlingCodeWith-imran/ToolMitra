import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Play,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import type { PageNumberFormat, PageNumberPosition } from '@/src/utils/pdfPageNumbers';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';
import type { WatermarkPlacement } from '@/src/utils/pdfWatermark';
import {
  runPdfWorkflowPipeline,
  type PdfWorkflowStepLog,
} from '@/src/utils/pdfWorkflow';

interface WorkflowInputFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  bytes: Uint8Array;
}

interface WorkflowOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
  stepLogs: PdfWorkflowStepLog[];
}

export function PdfWorkflowTool() {
  const [files, setFiles] = useState<WorkflowInputFile[]>([]);
  const [rotateAllDeg, setRotateAllDeg] = useState<0 | 90 | 180 | 270>(0);
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkPlacement, setWatermarkPlacement] = useState<WatermarkPlacement>('diagonal');
  const [enablePageNumbers, setEnablePageNumbers] = useState(true);
  const [pageNumberPosition, setPageNumberPosition] =
    useState<PageNumberPosition>('bottom-center');
  const [pageNumberFormat, setPageNumberFormat] = useState<PageNumberFormat>('n-of-total');
  const [enableCompress, setEnableCompress] = useState(true);
  const [stripMetadata, setStripMetadata] = useState(true);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<WorkflowOutput | null>(null);

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

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    clearOutput();
    setErrorMessage(null);
    setIsLoadingFiles(true);
    setStatusMessage('Validating PDF files...');

    const added: WorkflowInputFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!isPdfFileCandidate(file)) {
        setErrorMessage(`"${file.name}" is not a PDF file.`);
        continue;
      }
      if (file.size === 0 || file.size > 50 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" must be under 50 MB.`);
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pageCount = await inspectPdfBytes(bytes, file.name);
        added.push({
          id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          size: file.size,
          pageCount,
          bytes,
        });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      }
    }

    if (added.length > 0) {
      setFiles((prev) => [...prev, ...added].slice(0, 15));
    }
    setIsLoadingFiles(false);
    setStatusMessage(null);
  };

  const handleRunWorkflow = async () => {
    if (files.length === 0) {
      setErrorMessage('Add at least one PDF file before running the workflow.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsRunning(true);
    setStatusMessage('Running automated PDF workflow...');

    try {
      const result = await runPdfWorkflowPipeline(
        files.map((f) => ({ name: f.name, bytes: f.bytes })),
        {
          rotateAllDeg,
          enableWatermark,
          watermarkText,
          watermarkPlacement,
          watermarkOpacity: 0.25,
          enablePageNumbers,
          pageNumberPosition,
          pageNumberFormat,
          enableCompress,
          stripMetadata,
        },
        (msg) => setStatusMessage(msg),
      );

      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        url,
        filename: `${sanitizeBasePdfName(files[0].name, 'toolmitra')}-workflow.pdf`,
        size: blob.size,
        pageCount: result.pageCount,
        stepLogs: result.stepLogs,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Workflow execution failed.');
      setStatusMessage(null);
    } finally {
      setIsRunning(false);
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
          void addFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="workflow-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <FileUp className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {files.length > 0
            ? `${files.length} PDF ${files.length === 1 ? 'file' : 'files'} queued for batch workflow`
            : 'Drop one or more PDFs to run a multi-step processing pipeline'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Chain Merge → Rotate → Watermark → Page Numbers → Optimize Structure in one pass
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFiles || isRunning}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFiles ? 'Reading...' : files.length > 0 ? 'Add More PDFs' : 'Select PDF Files'}
          </button>
          {files.length > 0 && (
            <button
              type="button"
              disabled={isLoadingFiles || isRunning}
              onClick={() => {
                setFiles([]);
                clearOutput();
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear Queue</span>
            </button>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {files.map((f, idx) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-mono font-semibold text-slate-500">#{idx + 1}</span>{' '}
                <span className="font-medium text-slate-900 dark:text-slate-100">{f.name}</span>{' '}
                <span className="text-slate-500">
                  ({f.pageCount}p · {formatBytes(f.size)})
                </span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => {
                  setFiles((prev) => prev.filter((item) => item.id !== f.id));
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

      {/* Pipeline Steps */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Configure Automated Steps
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Step: Rotate */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <label
              htmlFor="wf-rotate"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              1. Rotate All Pages
            </label>
            <select
              id="wf-rotate"
              value={rotateAllDeg}
              onChange={(e) => {
                setRotateAllDeg(Number(e.target.value) as 0 | 90 | 180 | 270);
                clearOutput();
              }}
              className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value={0}>Keep original orientation (0°)</option>
              <option value={90}>Rotate 90° clockwise</option>
              <option value={180}>Rotate 180°</option>
              <option value={270}>Rotate 90° counter-clockwise</option>
            </select>
          </div>

          {/* Step: Compress */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={enableCompress}
                onChange={(e) => {
                  setEnableCompress(e.target.checked);
                  clearOutput();
                }}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span>4. Optimize PDF Streams (Lossless)</span>
            </label>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                disabled={!enableCompress}
                checked={stripMetadata}
                onChange={(e) => {
                  setStripMetadata(e.target.checked);
                  clearOutput();
                }}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              <span>Strip author/title metadata</span>
            </label>
          </div>

          {/* Step: Watermark */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={enableWatermark}
                onChange={(e) => {
                  setEnableWatermark(e.target.checked);
                  clearOutput();
                }}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span>2. Stamp Text Watermark</span>
            </label>
            {enableWatermark && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  aria-label="Workflow watermark text"
                  value={watermarkText}
                  onChange={(e) => {
                    setWatermarkText(e.target.value);
                    clearOutput();
                  }}
                  placeholder="CONFIDENTIAL"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <select
                  aria-label="Workflow watermark placement"
                  value={watermarkPlacement}
                  onChange={(e) => {
                    setWatermarkPlacement(e.target.value as WatermarkPlacement);
                    clearOutput();
                  }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="diagonal">Diagonal</option>
                  <option value="center">Center</option>
                  <option value="tiled">Tiled</option>
                  <option value="top-right">Top Right</option>
                </select>
              </div>
            )}
          </div>

          {/* Step: Page Numbers */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={enablePageNumbers}
                onChange={(e) => {
                  setEnablePageNumbers(e.target.checked);
                  clearOutput();
                }}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span>3. Add Page Numbers</span>
            </label>
            {enablePageNumbers && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <select
                  aria-label="Workflow page number position"
                  value={pageNumberPosition}
                  onChange={(e) => {
                    setPageNumberPosition(e.target.value as PageNumberPosition);
                    clearOutput();
                  }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                </select>
                <select
                  aria-label="Workflow page number format"
                  value={pageNumberFormat}
                  onChange={(e) => {
                    setPageNumberFormat(e.target.value as PageNumberFormat);
                    clearOutput();
                  }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="n-of-total">1 / N</option>
                  <option value="page-n-of-total">Page 1 of N</option>
                  <option value="n">1, 2, 3...</option>
                  <option value="page-n">Page 1, Page 2...</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={files.length === 0 || isRunning || isLoadingFiles}
          onClick={() => void handleRunWorkflow()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{isRunning ? 'Running Pipeline...' : 'Run PDF Workflow'}</span>
        </button>
      </div>

      {(isLoadingFiles || isRunning || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage}</p>
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
                  Workflow complete: {output.filename}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                  {output.pageCount} {output.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                  {formatBytes(output.size)} · {output.stepLogs.length} steps executed
                </p>
              </div>
            </div>

            <a
              href={output.url}
              download={output.filename}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download Output PDF</span>
            </a>
          </div>

          <ul className="space-y-1 border-t border-emerald-200/70 pt-3 text-xs text-emerald-900 dark:border-emerald-800/70 dark:text-emerald-200">
            {output.stepLogs.map((log, idx) => (
              <li key={idx}>
                <span className="font-semibold">{log.step}:</span> {log.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Executes every enabled step sequentially inside browser memory using ToolMitra&rsquo;s
          PDF engines—no intermediate files leave your device.
        </p>
      </div>
    </div>
  );
}
