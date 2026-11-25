import {
  AlertCircle,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  buildResizedFilename,
  clampResizeDimension,
  computeAspectLockedDimensions,
  computeScaledDimensions,
  inspectImageDimensions,
  MAX_RESIZE_DIMENSION_PX,
  MIN_RESIZE_DIMENSION_PX,
  resizeImageFile,
  type ResizedImageResult,
  type ResizeOutputFormat,
} from '@/src/utils/imageResize';
import { clampWebpQuality, formatSourceMimeLabel } from '@/src/utils/imageToWebp';

interface ResizeViewState {
  file: File;
  originalUrl: string;
  convertedUrl: string;
  data: ResizedImageResult;
}

const SCALE_PRESETS = [25, 50, 75, 150];
const DIMENSION_PRESETS = [
  { label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { label: '1080 × 1080 (Square)', width: 1080, height: 1080 },
  { label: '800 × 600 (Web)', width: 800, height: 600 },
];

export function ImageResizerTool() {
  const [targetWidth, setTargetWidth] = useState<number>(1280);
  const [targetHeight, setTargetHeight] = useState<number>(720);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [outputFormat, setOutputFormat] = useState<ResizeOutputFormat>('keep');
  const [quality, setQuality] = useState<number>(85);
  const [result, setResult] = useState<ResizeViewState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<ResizeViewState | null>(null);
  resultRef.current = result;

  useEffect(() => {
    return () => {
      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current.originalUrl);
        URL.revokeObjectURL(resultRef.current.convertedUrl);
      }
    };
  }, []);

  const revokeUrls = (state: ResizeViewState | null) => {
    if (!state) return;
    URL.revokeObjectURL(state.originalUrl);
    URL.revokeObjectURL(state.convertedUrl);
  };

  const runResize = async (
    file: File,
    width: number,
    height: number,
    fmt: ResizeOutputFormat,
    q: number,
  ) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await resizeImageFile(file, {
        width,
        height,
        outputFormat: fmt,
        quality: q,
      });

      const originalUrl = URL.createObjectURL(file);
      const convertedUrl = URL.createObjectURL(res.blob);

      setResult((prev) => {
        revokeUrls(prev);
        return {
          file,
          originalUrl,
          convertedUrl,
          data: res,
        };
      });
      setStatusMessage(
        `Resized ${file.name} from ${res.originalWidth}×${res.originalHeight} to ${res.targetWidth}×${res.targetHeight} px.`,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resize image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = files[0];
    setErrorMessage(null);
    setStatusMessage(null);
    setIsProcessing(true);

    try {
      const info = await inspectImageDimensions(picked);
      // Default to original width capped smoothly at 1280 if larger, preserving aspect ratio
      const initialW = info.width > 1280 ? 1280 : info.width;
      const initialDims = computeAspectLockedDimensions({
        originalWidth: info.width,
        originalHeight: info.height,
        changedAxis: 'width',
        nextValue: initialW,
      });
      setTargetWidth(initialDims.width);
      setTargetHeight(initialDims.height);
      await runResize(picked, initialDims.width, initialDims.height, outputFormat, quality);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not read image.');
      setIsProcessing(false);
    }
  };

  const handleWidthChange = (rawVal: number) => {
    const cleanW = clampResizeDimension(rawVal, targetWidth);
    if (lockAspect && result) {
      const next = computeAspectLockedDimensions({
        originalWidth: result.data.originalWidth,
        originalHeight: result.data.originalHeight,
        changedAxis: 'width',
        nextValue: cleanW,
      });
      setTargetWidth(next.width);
      setTargetHeight(next.height);
    } else {
      setTargetWidth(cleanW);
    }
  };

  const handleHeightChange = (rawVal: number) => {
    const cleanH = clampResizeDimension(rawVal, targetHeight);
    if (lockAspect && result) {
      const next = computeAspectLockedDimensions({
        originalWidth: result.data.originalWidth,
        originalHeight: result.data.originalHeight,
        changedAxis: 'height',
        nextValue: cleanH,
      });
      setTargetWidth(next.width);
      setTargetHeight(next.height);
    } else {
      setTargetHeight(cleanH);
    }
  };

  const handleScalePreset = async (pct: number) => {
    if (!result || isProcessing) return;
    const next = computeScaledDimensions(
      result.data.originalWidth,
      result.data.originalHeight,
      pct,
    );
    setTargetWidth(next.width);
    setTargetHeight(next.height);
    await runResize(result.file, next.width, next.height, outputFormat, quality);
  };

  const handleDimensionPreset = async (w: number, h: number) => {
    setLockAspect(false);
    setTargetWidth(w);
    setTargetHeight(h);
    if (result && !isProcessing) {
      await runResize(result.file, w, h, outputFormat, quality);
    }
  };

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleFileAdded(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileAdded(e.dataTransfer.files);
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.convertedUrl;
    link.download = buildResizedFilename(
      result.file.name,
      result.data.targetWidth,
      result.data.targetHeight,
      result.data.outputMime,
    );
    link.click();
  };

  const handleClear = () => {
    revokeUrls(result);
    setResult(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <div>
            <label
              htmlFor="resize-width-input"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Width (px)
            </label>
            <input
              id="resize-width-input"
              type="number"
              min={MIN_RESIZE_DIMENSION_PX}
              max={MAX_RESIZE_DIMENSION_PX}
              value={targetWidth}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="resize-height-input"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Height (px)
            </label>
            <input
              id="resize-height-input"
              type="number"
              min={MIN_RESIZE_DIMENSION_PX}
              max={MAX_RESIZE_DIMENSION_PX}
              value={targetHeight}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="resize-format-select"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Output Format
            </label>
            <select
              id="resize-format-select"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as ResizeOutputFormat)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="keep">Keep Original Format</option>
              <option value="image/webp">WebP</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG (Lossless)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="resize-quality-slider"
                className="text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Quality
              </label>
              <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {quality}%
              </span>
            </div>
            <input
              id="resize-quality-slider"
              type="range"
              min={10}
              max={100}
              step={5}
              value={quality}
              onChange={(e) => setQuality(Math.max(10, clampWebpQuality(Number(e.target.value))))}
              className="mt-4 w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setLockAspect((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              lockAspect
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
            }`}
          >
            {lockAspect ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            <span>{lockAspect ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}</span>
          </button>

          {result &&
            SCALE_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={isProcessing}
                onClick={() => handleScalePreset(pct)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {pct}% Scale
              </button>
            ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Presets:</span>
          {DIMENSION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={isProcessing}
              onClick={() => handleDimensionPreset(preset.width, preset.height)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {result && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => runResize(result.file, targetWidth, targetHeight, outputFormat, quality)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isProcessing ? 'Resizing...' : `Apply Resize (${targetWidth}×${targetHeight})`}</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear Image</span>
            </button>
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
          id="image-resizer-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="sr-only"
        />
        <ImagePlus className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drag and drop one JPG, PNG, or WebP image to resize
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Max 25 MB · Supports {MIN_RESIZE_DIMENSION_PX}px to {MAX_RESIZE_DIMENSION_PX}px output dimensions locally.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {result ? 'Select Another Image' : 'Select Image'}
        </button>
      </div>

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
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {result && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {result.data.originalWidth}×{result.data.originalHeight} px (
                {formatSourceMimeLabel(result.data.sourceMime)}, {formatBytes(result.file.size)}) →{' '}
                <span className="text-blue-600 dark:text-blue-400">
                  {result.data.targetWidth}×{result.data.targetHeight} px (
                  {formatSourceMimeLabel(result.data.outputMime)},{' '}
                  {formatBytes(result.data.blob.size)})
                </span>
              </p>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {result.data.sizeDiff.direction === 'smaller'
                  ? `−${result.data.sizeDiff.percentChange}% smaller (−${formatBytes(result.data.sizeDiff.absDeltaBytes)})`
                  : result.data.sizeDiff.direction === 'larger'
                    ? `+${result.data.sizeDiff.percentChange}% larger (+${formatBytes(result.data.sizeDiff.absDeltaBytes)})`
                    : 'Same byte size'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>
                Download{' '}
                {buildResizedFilename(
                  result.file.name,
                  result.data.targetWidth,
                  result.data.targetHeight,
                  result.data.outputMime,
                )}
              </span>
            </button>
          </div>

          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <img
              src={result.convertedUrl}
              alt={`Resized preview (${result.data.targetWidth} by ${result.data.targetHeight} pixels)`}
              className="max-h-[420px] max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
