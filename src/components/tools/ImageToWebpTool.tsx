import {
  AlertCircle,
  CheckCircle2,
  Download,
  ImagePlus,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  buildWebpDownloadFilename,
  clampWebpQuality,
  computeSizeDifference,
  convertImageFileToWebp,
  formatSourceMimeLabel,
  type SupportedWebpSourceMime,
} from '@/src/utils/imageToWebp';

interface ConversionState {
  file: File;
  sourceMime: SupportedWebpSourceMime;
  originalUrl: string;
  originalSize: number;
  convertedBlob: Blob;
  convertedUrl: string;
  convertedSize: number;
  width: number;
  height: number;
  qualityUsed: number;
  hasTransparency: boolean;
}

const QUALITY_PRESETS = [
  { label: 'Compact (65)', value: 65 },
  { label: 'Balanced (82)', value: 82 },
  { label: 'High (92)', value: 92 },
  { label: 'Max (100)', value: 100 },
];

export function ImageToWebpTool() {
  const [quality, setQuality] = useState<number>(82);
  const [result, setResult] = useState<ConversionState | null>(null);
  const [previewTab, setPreviewTab] = useState<'converted' | 'original'>('converted');
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<ConversionState | null>(null);
  resultRef.current = result;

  useEffect(() => {
    return () => {
      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current.originalUrl);
        URL.revokeObjectURL(resultRef.current.convertedUrl);
      }
    };
  }, []);

  const revokeUrls = (state: ConversionState | null) => {
    if (!state) return;
    URL.revokeObjectURL(state.originalUrl);
    URL.revokeObjectURL(state.convertedUrl);
  };

  const runConversion = async (file: File, targetQuality: number, extraNotice?: string | null) => {
    const safeQuality = clampWebpQuality(targetQuality);
    setIsConverting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    if (extraNotice !== undefined) {
      setNoticeMessage(extraNotice);
    }

    try {
      const converted = await convertImageFileToWebp(file, safeQuality);
      const originalUrl = URL.createObjectURL(file);
      const convertedUrl = URL.createObjectURL(converted.blob);

      setResult((prev) => {
        revokeUrls(prev);
        return {
          file,
          sourceMime: converted.sourceMime,
          originalUrl,
          originalSize: file.size,
          convertedBlob: converted.blob,
          convertedUrl,
          convertedSize: converted.blob.size,
          width: converted.width,
          height: converted.height,
          qualityUsed: converted.qualityUsed,
          hasTransparency: converted.hasTransparency,
        };
      });
      setPreviewTab('converted');
      setStatusMessage(`Converted ${file.name} to WebP locally at quality ${converted.qualityUsed}/100.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to convert image to WebP.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSelectedFileList = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = files[0];
    const extraNotice =
      files.length > 1
        ? `Single-image converter: loaded "${picked.name}" and ignored ${files.length - 1} additional ${
            files.length - 1 === 1 ? 'file' : 'files'
          }.`
        : null;

    await runConversion(picked, quality, extraNotice);
  };

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleSelectedFileList(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleSelectedFileList(e.dataTransfer.files);
  };

  const handleQualityChange = (nextVal: number) => {
    setQuality(clampWebpQuality(nextVal));
  };

  const handleApplyQuality = async () => {
    if (!result || isConverting) return;
    await runConversion(result.file, quality, noticeMessage);
  };

  const handlePresetClick = async (presetValue: number) => {
    setQuality(presetValue);
    if (result && !isConverting) {
      await runConversion(result.file, presetValue, noticeMessage);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.convertedUrl;
    link.download = buildWebpDownloadFilename(result.file.name);
    link.click();
  };

  const handleClear = () => {
    revokeUrls(result);
    setResult(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setNoticeMessage(null);
  };

  const sizeDiff = result
    ? computeSizeDifference(result.originalSize, result.convertedSize)
    : null;

  const checkerboardBgStyle = {
    backgroundImage:
      'linear-gradient(45deg, rgba(148,163,184,0.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.18) 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  };

  return (
    <div className="space-y-6">
      {/* Quality & Options Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="webp-quality-slider"
                className="text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                WebP Quality (0–100)
              </label>
              <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {quality} / 100
              </span>
            </div>
            <input
              id="webp-quality-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => handleQualityChange(Number(e.target.value))}
              className="mt-3 w-full accent-blue-600"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>0 (Smallest / heaviest loss)</span>
              <span>50 (Medium)</span>
              <span>100 (Highest detail)</span>
            </div>
          </div>

          <div className="md:w-72">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Quick presets</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {QUALITY_PRESETS.map((preset) => {
                const isSelected = quality === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetClick(preset.value)}
                    disabled={isConverting}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Transparency from PNG and WebP files is preserved automatically. Animated multi-frame
          WebP/APNG images flatten to their first frame in browser Canvas, and high-quality settings
          may occasionally yield a larger file than an already-compressed source.
        </p>

        {result && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={isConverting}
              onClick={handleApplyQuality}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isConverting
                  ? 'Converting...'
                  : result.qualityUsed !== quality
                    ? `Re-convert at Quality ${quality}`
                    : 'Re-convert Image'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={isConverting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
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
          id="image-to-webp-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="sr-only"
        />
        <ImagePlus
          className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drag and drop one JPG, JPEG, PNG, or WebP image here
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Maximum 25 MB. Runs entirely in browser Canvas memory with zero file uploads.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isConverting}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {result ? 'Select Another Image' : 'Select Image'}
        </button>
      </div>

      {/* Processing / Error / Notice Banners */}
      {isConverting && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>Decoding and encoding image to WebP in your browser...</span>
        </div>
      )}

      {noticeMessage && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{noticeMessage}</p>
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

      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Results & Live Preview */}
      {result && sizeDiff && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          {/* Metrics Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Original ({formatSourceMimeLabel(result.sourceMime)})
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatBytes(result.originalSize)}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {result.width} × {result.height} px · {result.file.name}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Converted WebP (Q{result.qualityUsed})
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {formatBytes(result.convertedSize)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {result.hasTransparency
                  ? 'Transparent pixels preserved'
                  : 'Opaque output (no alpha channel)'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Actual Size Difference
              </p>
              <p
                className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                  sizeDiff.direction === 'smaller'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : sizeDiff.direction === 'larger'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {sizeDiff.direction === 'smaller' && `−${sizeDiff.percentChange}% smaller`}
                {sizeDiff.direction === 'larger' && `+${sizeDiff.percentChange}% larger`}
                {sizeDiff.direction === 'same' && '0% (same size)'}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {sizeDiff.direction === 'smaller'
                  ? `Saved ${formatBytes(sizeDiff.absDeltaBytes)}`
                  : sizeDiff.direction === 'larger'
                    ? `Increased by ${formatBytes(sizeDiff.absDeltaBytes)}`
                    : 'No byte difference'}
              </p>
            </div>
          </div>

          {sizeDiff.direction === 'larger' && (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                At quality {result.qualityUsed}, WebP produced a larger file than your source image
                (this can happen when re-encoding small, flat-color, or already tightly compressed
                images). Try lowering quality to 65–82 if smaller file size is your goal.
              </p>
            </div>
          )}

          {/* Preview Header & Download */}
          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center dark:border-slate-800">
            <div
              role="tablist"
              aria-label="Image preview comparison"
              className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-950"
            >
              <button
                type="button"
                role="tab"
                aria-selected={previewTab === 'converted'}
                onClick={() => setPreviewTab('converted')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  previewTab === 'converted'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Converted WebP
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewTab === 'original'}
                onClick={() => setPreviewTab('original')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  previewTab === 'original'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Original ({formatSourceMimeLabel(result.sourceMime)})
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download {buildWebpDownloadFilename(result.file.name)}</span>
            </button>
          </div>

          {/* Checkerboard Preview Container */}
          <div
            style={checkerboardBgStyle}
            className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <img
              src={previewTab === 'converted' ? result.convertedUrl : result.originalUrl}
              alt={
                previewTab === 'converted'
                  ? `Converted WebP preview of ${result.file.name}`
                  : `Original image preview of ${result.file.name}`
              }
              className="max-h-[420px] max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
