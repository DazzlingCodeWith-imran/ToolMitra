import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Info,
  Loader2,
  Minimize2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  COMPRESSION_PRESETS,
  compressPdfDocument,
  MAX_COMPRESS_FILE_BYTES,
  type CompressionPreset,
} from '@/src/utils/pdfCompress';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface CompressedPdfOutput {
  url: string;
  filename: string;
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  preset: CompressionPreset;
}

export function CompressPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedPdf | null>(null);
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [stripMetadata, setStripMetadata] = useState<boolean>(true);
  const [outputName, setOutputName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CompressedPdfOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const clearResult = () => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
  };

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
    };
  }, []);

  const handleFileLoad = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setErrorMessage(null);
    clearResult();

    if (fileList.length > 1) {
      setErrorMessage('Compress PDF processes one PDF at a time. Loaded the first selected file.');
    }

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file. Please select a .pdf document.`);
      return;
    }
    if (file.size === 0) {
      setErrorMessage(`"${file.name}" is empty (0 bytes).`);
      return;
    }
    if (file.size > MAX_COMPRESS_FILE_BYTES) {
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
      setOutputName(`${sanitizeBasePdfName(file.name, 'toolmitra')}-compressed`);
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
    clearResult();
    setSourcePdf(null);
    setOutputName('');
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleCompress = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }

    clearResult();
    setErrorMessage(null);
    setIsCompressing(true);
    setStatusMessage('Starting compression...');

    try {
      const compressed = await compressPdfDocument(
        sourcePdf.bytes,
        preset,
        stripMetadata,
        (msg) => setStatusMessage(msg),
      );

      const blob = new Blob([compressed.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;

      const cleanBase = sanitizeBasePdfName(
        outputName || `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-compressed`,
        'toolmitra-compressed',
      );

      setResult({
        url,
        filename: `${cleanBase}.pdf`,
        originalSize: sourcePdf.size,
        compressedSize: blob.size,
        pageCount: compressed.pageCount,
        preset: compressed.preset,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Compression failed. Please check the file and try another compression preset.',
      );
      setStatusMessage(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const sizeDiffBytes = result ? result.originalSize - result.compressedSize : 0;
  const savingsPct =
    result && result.originalSize > 0
      ? Math.round((sizeDiffBytes / result.originalSize) * 100)
      : 0;

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
          id="compress-pdf-input"
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
            ? `Loaded: ${sourcePdf.file.name} (${formatBytes(sourcePdf.size)})`
            : 'Drop a PDF document here to reduce file size'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Compressed directly in your browser
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isCompressing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isCompressing}
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
      {(isLoadingFile || isCompressing || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Compressing PDF locally...'}</p>
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

      {/* Compression Options */}
      {sourcePdf && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-400">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {sourcePdf.file.name}
                </p>
                <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {sourcePdf.pageCount} {sourcePdf.pageCount === 1 ? 'page' : 'pages'} · Original
                  size: {formatBytes(sourcePdf.size)}
                </p>
              </div>
            </div>
          </div>

          {/* Preset Selection */}
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Compression Mode
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COMPRESSION_PRESETS.map((option) => {
                const selected = preset === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                      selected
                        ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="compress-preset"
                      checked={selected}
                      onChange={() => {
                        setPreset(option.id);
                        clearResult();
                      }}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span className="text-xs leading-relaxed">
                      <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {option.label}
                      </strong>
                      <span className="mt-0.5 block text-slate-600 dark:text-slate-400">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {preset !== 'lossless' ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <p>
                <strong>Balanced, Strong, and Maximum</strong> presets optimize size by converting
                each page into compressed JPEG images inside a new PDF. For documents where
                selectable text or clickable links must stay intact, choose{' '}
                <strong>Lossless Structure</strong>.
              </p>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={stripMetadata}
                onChange={(e) => {
                  setStripMetadata(e.target.checked);
                  clearResult();
                }}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              <span>Strip unused document metadata (author, producer, title tags)</span>
            </label>
          )}

          {/* Output Filename & Trigger */}
          <div className="flex flex-col justify-between gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-end dark:border-slate-800">
            <div className="flex-1 sm:max-w-xs">
              <label
                htmlFor="compress-pdf-filename"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Output Filename
              </label>
              <div className="mt-1 flex items-center">
                <input
                  id="compress-pdf-filename"
                  type="text"
                  value={outputName}
                  onChange={(e) => {
                    setOutputName(e.target.value);
                    clearResult();
                  }}
                  placeholder="toolmitra-compressed"
                  className="h-10 w-full rounded-l-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <span className="inline-flex h-10 items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  .pdf
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isCompressing || isLoadingFile}
              onClick={() => void handleCompress()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isCompressing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isCompressing ? 'Compressing PDF...' : 'Compress PDF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Result Banner */}
      {result && (
        <div
          role="status"
          className={`flex flex-col justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center ${
            sizeDiffBytes > 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40'
              : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                sizeDiffBytes > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {sizeDiffBytes > 0
                  ? `Compressed PDF ready (${savingsPct}% smaller)`
                  : 'PDF already well-optimized for this mode'}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                {formatBytes(result.originalSize)} → {formatBytes(result.compressedSize)} ·{' '}
                {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}
              </p>
              {sizeDiffBytes <= 0 && (
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                  This output was not smaller than the source file. Try Strong or Maximum mode for
                  image-heavy PDFs, or keep your original PDF.
                </p>
              )}
            </div>
          </div>

          <a
            href={result.url}
            download={result.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Compressed PDF</span>
          </a>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Your PDF is compressed entirely on your device inside browser memory. No document is
          uploaded, stored, or processed on any remote server.
        </p>
      </div>
    </div>
  );
}
