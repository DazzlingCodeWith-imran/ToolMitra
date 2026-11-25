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
import { clampWebpQuality, formatSourceMimeLabel, type SupportedWebpSourceMime } from '@/src/utils/imageToWebp';
import {
  buildConvertedImageFilename,
  convertImageToPngOrJpg,
  type WebpTargetOutputMime,
} from '@/src/utils/webpConvert';
import type { SizeDifferenceSummary } from '@/src/utils/imageToWebp';

interface ConversionState {
  file: File;
  sourceMime: SupportedWebpSourceMime;
  outputMime: WebpTargetOutputMime;
  originalUrl: string;
  originalSize: number;
  convertedBlob: Blob;
  convertedUrl: string;
  convertedSize: number;
  width: number;
  height: number;
  qualityUsed: number;
  hasTransparency: boolean;
  sizeDiff: SizeDifferenceSummary;
}

const BG_SWATCHES = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Light Slate', hex: '#F1F5F9' },
  { label: 'Black', hex: '#0F172A' },
];

export function WebpToPngTool() {
  const [outputMime, setOutputMime] = useState<WebpTargetOutputMime>('image/png');
  const [jpgQuality, setJpgQuality] = useState<number>(90);
  const [jpgBackgroundHex, setJpgBackgroundHex] = useState<string>('#FFFFFF');
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

  const runConversion = async (
    file: File,
    targetMime: WebpTargetOutputMime,
    qualityVal: number,
    bgHex: string,
    extraNotice?: string | null,
  ) => {
    setIsConverting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    if (extraNotice !== undefined) {
      setNoticeMessage(extraNotice);
    }

    try {
      const res = await convertImageToPngOrJpg(file, {
        outputMime: targetMime,
        jpgQuality: qualityVal,
        jpgBackgroundHex: bgHex,
      });

      const originalUrl = URL.createObjectURL(file);
      const convertedUrl = URL.createObjectURL(res.blob);

      setResult((prev) => {
        revokeUrls(prev);
        return {
          file,
          sourceMime: res.sourceMime,
          outputMime: res.outputMime,
          originalUrl,
          originalSize: file.size,
          convertedBlob: res.blob,
          convertedUrl,
          convertedSize: res.blob.size,
          width: res.width,
          height: res.height,
          qualityUsed: res.qualityUsed,
          hasTransparency: res.hasTransparency,
          sizeDiff: res.sizeDiff,
        };
      });
      setPreviewTab('converted');
      const label = targetMime === 'image/png' ? 'PNG' : `JPG (Q${res.qualityUsed})`;
      setStatusMessage(`Converted ${file.name} to ${label} locally in your browser.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to convert image.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSelectedFileList = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = files[0];
    const extraNotice =
      files.length > 1
        ? `Single-image converter: loaded "${picked.name}" and skipped ${files.length - 1} other ${
            files.length - 1 === 1 ? 'file' : 'files'
          }.`
        : null;
    await runConversion(picked, outputMime, jpgQuality, jpgBackgroundHex, extraNotice);
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

  const handleFormatSwitch = async (nextMime: WebpTargetOutputMime) => {
    setOutputMime(nextMime);
    if (result && !isConverting) {
      await runConversion(result.file, nextMime, jpgQuality, jpgBackgroundHex, noticeMessage);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.convertedUrl;
    link.download = buildConvertedImageFilename(result.file.name, result.outputMime);
    link.click();
  };

  const handleClear = () => {
    revokeUrls(result);
    setResult(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setNoticeMessage(null);
  };

  const checkerboardBgStyle = {
    backgroundImage:
      'linear-gradient(45deg, rgba(148,163,184,0.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.18) 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  };

  return (
    <div className="space-y-6">
      {/* Output Settings */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Output Format</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isConverting}
                onClick={() => handleFormatSwitch('image/png')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  outputMime === 'image/png'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                PNG (Lossless)
              </button>
              <button
                type="button"
                disabled={isConverting}
                onClick={() => handleFormatSwitch('image/jpeg')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  outputMime === 'image/jpeg'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                JPG (Compact)
              </button>
            </div>
          </div>

          {outputMime === 'image/jpeg' ? (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="webp-to-jpg-quality"
                    className="text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    JPG Quality
                  </label>
                  <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {jpgQuality}%
                  </span>
                </div>
                <input
                  id="webp-to-jpg-quality"
                  type="range"
                  min={10}
                  max={100}
                  step={2}
                  value={jpgQuality}
                  onChange={(e) => setJpgQuality(Math.max(10, clampWebpQuality(Number(e.target.value))))}
                  className="mt-3 w-full accent-blue-600"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Transparency Fill Color
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {BG_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setJpgBackgroundHex(swatch.hex)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                        jpgBackgroundHex.toUpperCase() === swatch.hex
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-xs border border-slate-300"
                        style={{ backgroundColor: swatch.hex }}
                        aria-hidden="true"
                      />
                      <span>{swatch.label}</span>
                    </button>
                  ))}
                  <input
                    aria-label="Custom background hex color"
                    type="color"
                    value={jpgBackgroundHex}
                    onChange={(e) => setJpgBackgroundHex(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                PNG Encoding Notes
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                PNG uses lossless compression and preserves transparent WebP backgrounds cleanly.
                Because PNG is lossless, converting a compressed WebP into PNG often produces a
                larger file size.
              </p>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={isConverting}
              onClick={() =>
                runConversion(result.file, outputMime, jpgQuality, jpgBackgroundHex, noticeMessage)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isConverting ? 'Converting...' : 'Apply Settings & Re-convert'}</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={isConverting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
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
          id="webp-to-png-input"
          type="file"
          accept="image/webp,image/png,image/jpeg,.webp,.png,.jpg,.jpeg"
          onChange={handleInputChange}
          className="sr-only"
        />
        <ImagePlus className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drag and drop one WebP, PNG, or JPG image here
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Maximum 25 MB. Animated WebP files flatten to their first frame. Zero server uploads.
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

      {/* Results & Preview */}
      {result && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
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
                Converted {result.outputMime === 'image/png' ? 'PNG' : `JPG (Q${result.qualityUsed})`}
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {formatBytes(result.convertedSize)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {result.outputMime === 'image/png'
                  ? result.hasTransparency
                    ? 'Transparency preserved'
                    : 'Lossless opaque PNG'
                  : 'Flattened onto solid background'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Actual Size Difference
              </p>
              <p
                className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                  result.sizeDiff.direction === 'smaller'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : result.sizeDiff.direction === 'larger'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {result.sizeDiff.direction === 'smaller' && `−${result.sizeDiff.percentChange}% smaller`}
                {result.sizeDiff.direction === 'larger' && `+${result.sizeDiff.percentChange}% larger`}
                {result.sizeDiff.direction === 'same' && '0% (same size)'}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {result.sizeDiff.direction === 'smaller'
                  ? `Saved ${formatBytes(result.sizeDiff.absDeltaBytes)}`
                  : result.sizeDiff.direction === 'larger'
                    ? `Increased by ${formatBytes(result.sizeDiff.absDeltaBytes)}`
                    : 'No byte difference'}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center dark:border-slate-800">
            <div
              role="tablist"
              aria-label="Preview converted vs original"
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
                Converted ({result.outputMime === 'image/png' ? 'PNG' : 'JPG'})
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download {buildConvertedImageFilename(result.file.name, result.outputMime)}</span>
            </button>
          </div>

          <div
            style={checkerboardBgStyle}
            className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <img
              src={previewTab === 'converted' ? result.convertedUrl : result.originalUrl}
              alt={
                previewTab === 'converted'
                  ? `Converted image preview of ${result.file.name}`
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
