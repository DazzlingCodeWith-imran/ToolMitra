import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Hash,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import {
  addPageNumbersToPdf,
  formatPageNumberLabel,
  MAX_PAGE_NUMBERS_FILE_BYTES,
  type PageNumberFormat,
  type PageNumberPosition,
} from '@/src/utils/pdfPageNumbers';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface NumberedOutput {
  url: string;
  filename: string;
  size: number;
  numberedPages: number;
}

export function PageNumbersTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedPdf | null>(null);
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [format, setFormat] = useState<PageNumberFormat>('n-of-total');
  const [startPage, setStartPage] = useState<number>(1);
  const [startNumber, setStartNumber] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(11);
  const [marginPt, setMarginPt] = useState<number>(24);
  const [colorHex, setColorHex] = useState<string>('#334155');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<NumberedOutput | null>(null);

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
    if (file.size > MAX_PAGE_NUMBERS_FILE_BYTES) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setStartPage(1);
      setStartNumber(1);
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const previewLabel = useMemo(() => {
    const totalCount = sourcePdf ? Math.max(1, sourcePdf.pageCount - startPage + 1) : 10;
    const totalDisplay = startNumber + totalCount - 1;
    return formatPageNumberLabel(format, startNumber, totalDisplay);
  }, [sourcePdf, format, startPage, startNumber]);

  const handleApply = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (startPage < 1 || startPage > sourcePdf.pageCount) {
      setErrorMessage(`Start page must be between 1 and ${sourcePdf.pageCount}.`);
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsApplying(true);
    setStatusMessage('Adding page numbers...');

    try {
      const res = await addPageNumbersToPdf(
        sourcePdf.bytes,
        {
          position,
          format,
          startPage,
          startNumber,
          fontSize,
          marginPt,
          colorHex,
        },
        (msg) => setStatusMessage(msg),
      );
      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-numbered.pdf`,
        size: blob.size,
        numberedPages: res.numberedPages,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add page numbers.');
      setStatusMessage(null);
    } finally {
      setIsApplying(false);
    }
  };

  const positionOptions: Array<{ id: PageNumberPosition; label: string }> = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-center', label: 'Top Center' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-center', label: 'Bottom Center' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ];

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
          id="page-numbers-input"
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
            : 'Drop a PDF document here to insert clean page numbers'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Numbered locally in your browser
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

      {(isLoadingFile || isApplying || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Adding page numbers...'}</p>
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
                Numbered PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                Added numbers to {output.numberedPages}{' '}
                {output.numberedPages === 1 ? 'page' : 'pages'} · {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Numbered PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Position</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {positionOptions.map((opt) => {
                    const active = position === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPosition(opt.id);
                          clearOutput();
                        }}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pn-format"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Number Format
                  </label>
                  <select
                    id="pn-format"
                    value={format}
                    onChange={(e) => {
                      setFormat(e.target.value as PageNumberFormat);
                      clearOutput();
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="n">1, 2, 3...</option>
                    <option value="page-n">Page 1, Page 2...</option>
                    <option value="n-of-total">1 / {sourcePdf.pageCount}</option>
                    <option value="page-n-of-total">Page 1 of {sourcePdf.pageCount}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pn-color"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Text Color
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id="pn-color"
                      type="color"
                      value={colorHex}
                      onChange={(e) => {
                        setColorHex(e.target.value);
                        clearOutput();
                      }}
                      className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-700"
                    />
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {colorHex.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pn-start-page"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Start Numbering on Page
                  </label>
                  <input
                    id="pn-start-page"
                    type="number"
                    min={1}
                    max={sourcePdf.pageCount}
                    value={startPage}
                    onChange={(e) => {
                      setStartPage(Math.max(1, Number(e.target.value) || 1));
                      clearOutput();
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Set to 2 to skip a cover page.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="pn-start-num"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    First Printed Number
                  </label>
                  <input
                    id="pn-start-num"
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={(e) => {
                      setStartNumber(Math.max(1, Number(e.target.value) || 1));
                      clearOutput();
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="pn-size"
                      className="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      Font Size
                    </label>
                    <span className="font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                      {fontSize} pt
                    </span>
                  </div>
                  <input
                    id="pn-size"
                    type="range"
                    min={8}
                    max={24}
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(Number(e.target.value));
                      clearOutput();
                    }}
                    className="mt-3 w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="pn-margin"
                      className="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      Edge Margin
                    </label>
                    <span className="font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                      {marginPt} pt
                    </span>
                  </div>
                  <input
                    id="pn-margin"
                    type="range"
                    min={12}
                    max={64}
                    value={marginPt}
                    onChange={(e) => {
                      setMarginPt(Number(e.target.value));
                      clearOutput();
                    }}
                    className="mt-3 w-full accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Sheet Preview */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Placement Preview
              </p>
              <div className="relative mx-auto my-4 h-56 w-40 rounded-lg border border-slate-300 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-900">
                <div className="space-y-2 opacity-20">
                  <div className="h-2 w-24 rounded bg-slate-400" />
                  <div className="h-2 w-full rounded bg-slate-400" />
                  <div className="h-2 w-5/6 rounded bg-slate-400" />
                  <div className="h-2 w-2/3 rounded bg-slate-400" />
                </div>
                <span
                  style={{ color: colorHex }}
                  className={`absolute font-mono text-xs font-semibold ${
                    position === 'top-left'
                      ? 'top-2.5 left-3'
                      : position === 'top-center'
                        ? 'top-2.5 left-1/2 -translate-x-1/2'
                        : position === 'top-right'
                          ? 'top-2.5 right-3'
                          : position === 'bottom-left'
                            ? 'bottom-2.5 left-3'
                            : position === 'bottom-center'
                              ? 'bottom-2.5 left-1/2 -translate-x-1/2'
                              : 'right-3 bottom-2.5'
                  }`}
                >
                  {previewLabel}
                </span>
              </div>

              <button
                type="button"
                disabled={isApplying || isLoadingFile}
                onClick={() => void handleApply()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isApplying ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Hash className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isApplying ? 'Applying...' : 'Add Page Numbers'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p>
          Page numbers are embedded locally inside your browser without uploading files.
        </p>
      </div>
    </div>
  );
}
