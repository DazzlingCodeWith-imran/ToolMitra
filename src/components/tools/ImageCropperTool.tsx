import {
  AlertCircle,
  CheckCircle2,
  Crop,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Loader2,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  buildCroppedFilename,
  computePixelCropRect,
  computePresetCropBox,
  cropAndTransformImageFile,
  getOrientedDimensions,
  normalizeCropPercentBox,
  type CropAspectPreset,
  type CropOutputFormat,
  type CropPercentBox,
  type CroppedImageResult,
  type CropRotationDeg,
} from '@/src/utils/imageCrop';
import { inspectImageDimensions } from '@/src/utils/imageResize';
import { clampWebpQuality, formatSourceMimeLabel } from '@/src/utils/imageToWebp';

interface CropOutputState {
  url: string;
  data: CroppedImageResult;
  filename: string;
}

const ASPECT_PRESETS: Array<{ value: CropAspectPreset; label: string }> = [
  { value: 'free', label: 'Freeform' },
  { value: '1:1', label: '1:1 Square' },
  { value: '4:3', label: '4:3 Standard' },
  { value: '16:9', label: '16:9 Widescreen' },
  { value: '3:4', label: '3:4 Portrait' },
];

export function ImageCropperTool() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [rotationDeg, setRotationDeg] = useState<CropRotationDeg>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspectPreset, setAspectPreset] = useState<CropAspectPreset>('free');
  const [cropBox, setCropBox] = useState<CropPercentBox>({
    xPct: 5,
    yPct: 5,
    widthPct: 90,
    heightPct: 90,
  });
  const [outputFormat, setOutputFormat] = useState<CropOutputFormat>('keep');
  const [quality, setQuality] = useState<number>(90);
  const [output, setOutput] = useState<CropOutputState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  sourceUrlRef.current = sourceUrl;
  outputUrlRef.current = output?.url ?? null;

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  const handleLoadFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = files[0];
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const dims = await inspectImageDimensions(picked);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (output) URL.revokeObjectURL(output.url);

      const nextUrl = URL.createObjectURL(picked);
      setSourceFile(picked);
      setSourceUrl(nextUrl);
      setNaturalSize({ width: dims.width, height: dims.height });
      setRotationDeg(0);
      setFlipH(false);
      setFlipV(false);
      setAspectPreset('free');
      setCropBox({ xPct: 5, yPct: 5, widthPct: 90, heightPct: 90 });
      setOutput(null);
      setStatusMessage(`Loaded ${picked.name} (${dims.width}×${dims.height} px). Adjust crop or transforms below.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load image.');
    }
  };

  const handleRotate90 = () => {
    const nextRot = (((rotationDeg + 90) % 360) as CropRotationDeg);
    setRotationDeg(nextRot);
    if (naturalSize && aspectPreset !== 'free') {
      const oriented = getOrientedDimensions(naturalSize.width, naturalSize.height, nextRot);
      setCropBox(computePresetCropBox(oriented.width, oriented.height, aspectPreset));
    }
  };

  const handlePresetSelect = (preset: CropAspectPreset) => {
    setAspectPreset(preset);
    if (!naturalSize) return;
    const oriented = getOrientedDimensions(naturalSize.width, naturalSize.height, rotationDeg);
    setCropBox(computePresetCropBox(oriented.width, oriented.height, preset));
  };

  const updateBox = (patch: Partial<CropPercentBox>) => {
    setAspectPreset('free');
    setCropBox((prev) => normalizeCropPercentBox({ ...prev, ...patch }));
  };

  const handleApplyCrop = async () => {
    if (!sourceFile) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await cropAndTransformImageFile(sourceFile, {
        cropBox,
        rotationDeg,
        flipHorizontal: flipH,
        flipVertical: flipV,
        outputFormat,
        quality,
      });

      if (output) URL.revokeObjectURL(output.url);
      const nextUrl = URL.createObjectURL(res.blob);
      const filename = buildCroppedFilename(sourceFile.name, res.outputMime);

      setOutput({ url: nextUrl, data: res, filename });
      setStatusMessage(`Exported cropped image (${res.width}×${res.height} px) locally.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to crop image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const link = document.createElement('a');
    link.href = output.url;
    link.download = output.filename;
    link.click();
  };

  const handleClear = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (output) URL.revokeObjectURL(output.url);
    setSourceFile(null);
    setSourceUrl(null);
    setNaturalSize(null);
    setOutput(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleLoadFile(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleLoadFile(e.dataTransfer.files);
  };

  const predictedRect = naturalSize
    ? computePixelCropRect(naturalSize.width, naturalSize.height, rotationDeg, cropBox)
    : null;

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
          id="image-cropper-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="sr-only"
        />
        <ImagePlus className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drag and drop one JPG, PNG, or WebP image to crop or rotate
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Max 25 MB · All cropping, rotation, and flipping runs locally in browser Canvas.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {sourceFile ? 'Select Another Image' : 'Select Image'}
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

      {sourceFile && sourceUrl && predictedRect && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          {/* Transform & Aspect Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRotate90}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Rotate 90° ({rotationDeg}°)</span>
              </button>
              <button
                type="button"
                onClick={() => setFlipH((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  flipH
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
                <span>Flip H</span>
              </button>
              <button
                type="button"
                onClick={() => setFlipV((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  flipV
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
                <span>Flip V</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* Aspect Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Aspect:</span>
            {ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  aspectPreset === preset.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Visual Frame + Sliders Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="relative inline-block overflow-hidden rounded">
                <img
                  src={sourceUrl}
                  alt="Crop preview source"
                  style={{
                    transform: `rotate(${rotationDeg}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  }}
                  className="block max-h-[340px] max-w-full object-contain transition-transform duration-150"
                />
                <div
                  aria-hidden="true"
                  style={{
                    left: `${cropBox.xPct}%`,
                    top: `${cropBox.yPct}%`,
                    width: `${cropBox.widthPct}%`,
                    height: `${cropBox.heightPct}%`,
                  }}
                  className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="crop-x-range" className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Left Offset</span>
                    <span className="font-mono">{cropBox.xPct}%</span>
                  </label>
                  <input
                    id="crop-x-range"
                    type="range"
                    min={0}
                    max={90}
                    value={cropBox.xPct}
                    onChange={(e) => updateBox({ xPct: Number(e.target.value) })}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="crop-y-range" className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Top Offset</span>
                    <span className="font-mono">{cropBox.yPct}%</span>
                  </label>
                  <input
                    id="crop-y-range"
                    type="range"
                    min={0}
                    max={90}
                    value={cropBox.yPct}
                    onChange={(e) => updateBox({ yPct: Number(e.target.value) })}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="crop-w-range" className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Crop Width</span>
                    <span className="font-mono">{cropBox.widthPct}%</span>
                  </label>
                  <input
                    id="crop-w-range"
                    type="range"
                    min={5}
                    max={100 - cropBox.xPct}
                    value={cropBox.widthPct}
                    onChange={(e) => updateBox({ widthPct: Number(e.target.value) })}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="crop-h-range" className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Crop Height</span>
                    <span className="font-mono">{cropBox.heightPct}%</span>
                  </label>
                  <input
                    id="crop-h-range"
                    type="range"
                    min={5}
                    max={100 - cropBox.yPct}
                    value={cropBox.heightPct}
                    onChange={(e) => updateBox({ heightPct: Number(e.target.value) })}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="crop-output-format" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Output Format
                  </label>
                  <select
                    id="crop-output-format"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as CropOutputFormat)}
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="keep">Keep Original</option>
                    <option value="image/png">PNG (Lossless)</option>
                    <option value="image/jpeg">JPG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="crop-quality-range" className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Quality</span>
                    <span className="font-mono">{quality}%</span>
                  </label>
                  <input
                    id="crop-quality-range"
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={quality}
                    onChange={(e) => setQuality(Math.max(10, clampWebpQuality(Number(e.target.value))))}
                    className="mt-3 w-full accent-blue-600"
                  />
                </div>
              </div>

              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Output region: {predictedRect.sw} × {predictedRect.sh} px
              </p>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleApplyCrop}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Crop className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isProcessing ? 'Exporting...' : 'Crop & Export Image'}</span>
              </button>
            </div>
          </div>

          {/* Exported Output */}
          {output && (
            <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Exported {output.data.width}×{output.data.height} px (
                  {formatSourceMimeLabel(output.data.outputMime)}, {formatBytes(output.data.blob.size)})
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download {output.filename}</span>
                </button>
              </div>
              <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <img
                  src={output.url}
                  alt="Cropped exported image preview"
                  className="max-h-[340px] max-w-full rounded object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
