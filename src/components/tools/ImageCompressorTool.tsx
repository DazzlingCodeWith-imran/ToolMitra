import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';

type OutputFormat = 'keep' | 'image/jpeg' | 'image/webp' | 'image/png';

interface CompressedImageItem {
  id: string;
  file: File;
  originalUrl: string;
  originalSize: number;
  width: number;
  height: number;
  compressedBlob: Blob | null;
  compressedUrl: string | null;
  compressedSize: number | null;
  outputMime: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getExtensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function getCompressedFileName(originalName: string, targetMime: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-compressed.${getExtensionForMime(targetMime)}`;
}

async function decodeImage(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => bitmap.close(),
    };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image file.'));
    };
    img.src = url;
  });
}

async function compressSingleFile(
  file: File,
  quality: number,
  format: OutputFormat,
  maxWidth: number,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  outputMime: string;
}> {
  const targetMime = format === 'keep' ? file.type || 'image/jpeg' : format;
  const decoded = await decodeImage(file);

  try {
    let targetWidth = decoded.width;
    let targetHeight = decoded.height;

    if (maxWidth > 0 && targetWidth > maxWidth) {
      const ratio = maxWidth / targetWidth;
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, targetWidth);
    canvas.height = Math.max(1, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas context is unavailable.');
    }

    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    decoded.draw(ctx, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Compression failed in browser canvas.'));
          }
        },
        targetMime,
        targetMime === 'image/png' ? undefined : Math.max(0.1, Math.min(1, quality / 100)),
      );
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      outputMime: targetMime,
    };
  } finally {
    decoded.cleanup();
  }
}

export function ImageCompressorTool() {
  const [items, setItems] = useState<CompressedImageItem[]>([]);
  const [quality, setQuality] = useState<number>(80);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('keep');
  const [maxWidth, setMaxWidth] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<CompressedImageItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      }
    };
  }, []);

  const runCompression = async (
    targetItems: CompressedImageItem[],
    q: number,
    fmt: OutputFormat,
    maxW: number,
  ) => {
    if (targetItems.length === 0) return;
    setIsProcessing(true);
    setStatusMessage(null);

    const updated: CompressedImageItem[] = [];
    for (const item of targetItems) {
      if (item.compressedUrl) {
        URL.revokeObjectURL(item.compressedUrl);
      }
      try {
        const res = await compressSingleFile(item.file, q, fmt, maxW);
        const compressedUrl = URL.createObjectURL(res.blob);
        updated.push({
          ...item,
          width: res.width,
          height: res.height,
          compressedBlob: res.blob,
          compressedUrl,
          compressedSize: res.blob.size,
          outputMime: res.outputMime,
          status: 'done',
          error: undefined,
        });
      } catch (err) {
        updated.push({
          ...item,
          compressedBlob: null,
          compressedUrl: null,
          compressedSize: null,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to compress image.',
        });
      }
    }

    setItems(updated);
    setIsProcessing(false);
    const doneCount = updated.filter((i) => i.status === 'done').length;
    if (doneCount > 0) {
      setStatusMessage(
        `Compressed ${doneCount} ${doneCount === 1 ? 'image' : 'images'} locally in your browser.`,
      );
    }
  };

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);
    setStatusMessage(null);

    const incoming = Array.from(fileList);
    const availableSlots = MAX_FILES - items.length;
    if (availableSlots <= 0) {
      setErrorMessage(`Batch limit reached (${MAX_FILES} images maximum). Clear some files first.`);
      return;
    }

    const rejected: string[] = [];
    const accepted: CompressedImageItem[] = [];

    const resolveMime = (file: File): string | null => {
      if (ALLOWED_TYPES.has(file.type)) return file.type;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
      if (lower.endsWith('.png')) return 'image/png';
      if (lower.endsWith('.webp')) return 'image/webp';
      return null;
    };

    for (const file of incoming) {
      if (accepted.length >= availableSlots) {
        rejected.push(`${file.name} (exceeds ${MAX_FILES}-image limit)`);
        continue;
      }
      const detectedMime = resolveMime(file);
      if (!detectedMime) {
        rejected.push(`${file.name} (unsupported format — use JPG, PNG, or WebP)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (exceeds 25 MB limit)`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        originalUrl: URL.createObjectURL(file),
        originalSize: file.size,
        width: 0,
        height: 0,
        compressedBlob: null,
        compressedUrl: null,
        compressedSize: null,
        outputMime: outputFormat === 'keep' ? detectedMime : outputFormat,
        status: 'pending',
      });
    }

    if (rejected.length > 0) {
      setErrorMessage(`Skipped ${rejected.length} file(s): ${rejected.join('; ')}`);
    }

    if (accepted.length === 0) return;

    const combined = [...items, ...accepted];
    setItems(combined);
    await runCompression(combined, quality, outputFormat, maxWidth);
  };

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleFilesAdded(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFilesAdded(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.compressedUrl) URL.revokeObjectURL(target.compressedUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    for (const item of items) {
      URL.revokeObjectURL(item.originalUrl);
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    }
    setItems([]);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleDownloadOne = (item: CompressedImageItem) => {
    if (!item.compressedUrl) return;
    const link = document.createElement('a');
    link.href = item.compressedUrl;
    link.download = getCompressedFileName(item.file.name, item.outputMime);
    link.click();
  };

  const handleDownloadAllZip = async () => {
    const readyItems = items.filter((i) => i.compressedBlob && i.status === 'done');
    if (readyItems.length === 0) return;
    setIsZipping(true);
    setErrorMessage(null);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      readyItems.forEach((item, index) => {
        if (!item.compressedBlob) return;
        const filename = getCompressedFileName(item.file.name, item.outputMime);
        zip.file(`${index + 1}-${filename}`, item.compressedBlob);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'toolmitra-compressed-images.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorMessage('Could not create ZIP archive. Try downloading files individually.');
    } finally {
      setIsZipping(false);
    }
  };

  const completedItems = items.filter((i) => i.status === 'done' && i.compressedSize !== null);
  const totalOriginal = completedItems.reduce((sum, i) => sum + i.originalSize, 0);
  const totalCompressed = completedItems.reduce((sum, i) => sum + (i.compressedSize ?? 0), 0);
  const totalSavingsPct =
    totalOriginal > 0 ? Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100) : 0;

  const hasPngLosslessNotice =
    items.some((i) => i.file.type === 'image/png') &&
    (outputFormat === 'keep' || outputFormat === 'image/png');

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="compression-quality"
                className="text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Quality
              </label>
              <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {quality}%
              </span>
            </div>
            <input
              id="compression-quality"
              type="range"
              min={10}
              max={100}
              step={5}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="mt-3 w-full accent-blue-600"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Smaller file</span>
              <span>Higher detail</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="output-format"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Output Format
            </label>
            <select
              id="output-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="keep">Keep Original Format</option>
              <option value="image/webp">Convert to WebP (Smallest)</option>
              <option value="image/jpeg">Convert to JPG</option>
              <option value="image/png">Convert to PNG (Lossless)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="max-width"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Max Width
            </label>
            <select
              id="max-width"
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value={0}>Keep Original Dimensions</option>
              <option value={1920}>1920 px (Full HD)</option>
              <option value={1280}>1280 px (Web Standard)</option>
              <option value={800}>800 px (Thumbnails / Email)</option>
            </select>
          </div>
        </div>

        {hasPngLosslessNotice && (
          <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
            Note: PNG uses lossless encoding in browsers, so quality sliders do not shrink PNG
            files. Switch Output Format to <strong>WebP</strong> or <strong>JPG</strong> for
            stronger compression.
          </p>
        )}

        {items.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => runCompression(items, quality, outputFormat, maxWidth)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isProcessing ? 'Compressing...' : 'Apply Settings & Re-compress'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {completedItems.length >= 2 && (
                <button
                  type="button"
                  disabled={isZipping || isProcessing}
                  onClick={handleDownloadAllZip}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FileArchive className="h-4 w-4" aria-hidden="true" />
                  <span>{isZipping ? 'Creating ZIP...' : 'Download All (ZIP)'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Clear All</span>
              </button>
            </div>
          </div>
        )}
      </div>

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
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
          className="sr-only"
          id="image-compressor-input"
        />
        <ImagePlus
          className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drag and drop JPG, PNG, or WebP images here
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to 20 images per batch, max 25 MB each. Nothing leaves your browser.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Select Images
        </button>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
          {completedItems.length > 0 && (
            <span className="font-mono text-xs font-semibold tabular-nums">
              {formatBytes(totalOriginal)} → {formatBytes(totalCompressed)} (
              {totalSavingsPct >= 0
                ? `${totalSavingsPct}% smaller`
                : `${Math.abs(totalSavingsPct)}% larger`}
              )
            </span>
          )}
        </div>
      )}

      {/* Output Queue */}
      {items.length > 0 && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {items.map((item) => {
            const diffPct =
              item.compressedSize !== null && item.originalSize > 0
                ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100)
                : null;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <img
                    src={item.compressedUrl || item.originalUrl}
                    alt={item.file.name}
                    className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-800"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.file.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {item.width > 0 ? `${item.width}×${item.height} px · ` : ''}
                      {formatBytes(item.originalSize)}
                      {item.compressedSize !== null && ` → ${formatBytes(item.compressedSize)}`}
                      {diffPct !== null &&
                        (diffPct >= 0 ? ` (−${diffPct}%)` : ` (+${Math.abs(diffPct)}%)`)}
                    </p>
                    {item.status === 'error' && item.error && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.status === 'done' && item.compressedUrl ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadOne(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {item.status === 'error' ? 'Failed' : 'Processing...'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
