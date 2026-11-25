import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Stamp,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { parsePageRanges, sanitizeBasePdfName } from '@/src/utils/pdfSplit';
import {
  applyPdfWatermark,
  MAX_WATERMARK_FILE_BYTES,
  type WatermarkKind,
  type WatermarkPlacement,
} from '@/src/utils/pdfWatermark';

interface LoadedWatermarkPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface WatermarkedOutput {
  url: string;
  filename: string;
  size: number;
  watermarkedPages: number;
}

export function WatermarkPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedWatermarkPdf | null>(null);
  const [kind, setKind] = useState<WatermarkKind>('text');
  const [text, setText] = useState<string>('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState<number>(42);
  const [colorHex, setColorHex] = useState<string>('#2563EB');
  const [opacityPct, setOpacityPct] = useState<number>(25);
  const [placement, setPlacement] = useState<WatermarkPlacement>('diagonal');

  const [imageFileName, setImageFileName] = useState<string>('');
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [imageType, setImageType] = useState<'png' | 'jpg'>('png');
  const [scalePercent, setScalePercent] = useState<number>(30);

  const [targetMode, setTargetMode] = useState<'all' | 'range'>('all');
  const [rangeInput, setRangeInput] = useState<string>('1');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<WatermarkedOutput | null>(null);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
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

  const handlePdfLoad = async (fileList: FileList | null) => {
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
    if (file.size > MAX_WATERMARK_FILE_BYTES) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setRangeInput(pageCount > 1 ? `1-${pageCount}` : '1');
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearOutput();
    setErrorMessage(null);

    const lower = file.name.toLowerCase();
    const isPng = file.type === 'image/png' || lower.endsWith('.png');
    const isJpg =
      file.type === 'image/jpeg' || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    if (!isPng && !isJpg) {
      setErrorMessage('Watermark image must be PNG or JPG.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Watermark image must be 10 MB or smaller.');
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    setImageBytes(bytes);
    setImageType(isPng ? 'png' : 'jpg');
    setImageFileName(file.name);
  };

  const pagePlan = useMemo(() => {
    if (!sourcePdf) return { valid: false, pages: 'all' as const, error: null as string | null };
    if (targetMode === 'all') return { valid: true, pages: 'all' as const, error: null };
    const parsed = parsePageRanges(rangeInput, sourcePdf.pageCount);
    if (!parsed.valid) return { valid: false, pages: [] as number[], error: parsed.error };
    return { valid: true, pages: parsed.flatUniquePages, error: null };
  }, [sourcePdf, targetMode, rangeInput]);

  const handleApply = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (!pagePlan.valid) {
      setErrorMessage(pagePlan.error || 'Enter valid pages.');
      return;
    }
    if (kind === 'text' && !text.trim()) {
      setErrorMessage('Enter watermark text before applying.');
      return;
    }
    if (kind === 'image' && !imageBytes) {
      setErrorMessage('Upload a PNG or JPG logo/image for your watermark.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsApplying(true);
    setStatusMessage('Adding watermark...');

    try {
      const options =
        kind === 'text'
          ? {
              kind: 'text' as const,
              text,
              fontSize,
              opacity: opacityPct / 100,
              colorHex,
              placement,
            }
          : {
              kind: 'image' as const,
              imageBytes: imageBytes!,
              imageType,
              scalePercent,
              opacity: opacityPct / 100,
              placement,
            };

      const res = await applyPdfWatermark(sourcePdf.bytes, options, pagePlan.pages, (msg) =>
        setStatusMessage(msg),
      );
      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-watermarked.pdf`,
        size: blob.size,
        watermarkedPages: res.watermarkedPages,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to apply watermark.');
      setStatusMessage(null);
    } finally {
      setIsApplying(false);
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
          void handlePdfLoad(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={pdfInputRef}
          id="watermark-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void handlePdfLoad(e.target.files);
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
            : 'Drop a PDF file here to stamp a text or image watermark'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Processed locally in your browser
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isApplying}
            onClick={() => pdfInputRef.current?.click()}
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
          <p>{statusMessage || 'Applying watermark...'}</p>
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
                Watermarked PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                Watermarked {output.watermarkedPages}{' '}
                {output.watermarkedPages === 1 ? 'page' : 'pages'} · {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Watermarked PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          {/* Type Switch */}
          <div
            role="tablist"
            aria-label="Watermark type"
            className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950"
          >
            {(
              [
                { id: 'text', label: 'Text Watermark' },
                { id: 'image', label: 'Image / Logo Watermark' },
              ] as const
            ).map((tab) => {
              const active = kind === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setKind(tab.id);
                    clearOutput();
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {kind === 'text' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="watermark-text-input"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Watermark Text
                </label>
                <input
                  id="watermark-text-input"
                  type="text"
                  maxLength={80}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    clearOutput();
                  }}
                  placeholder="CONFIDENTIAL"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="watermark-size"
                    className="text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Font Size
                  </label>
                  <span className="font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                    {fontSize} pt
                  </span>
                </div>
                <input
                  id="watermark-size"
                  type="range"
                  min={14}
                  max={96}
                  step={2}
                  value={fontSize}
                  onChange={(e) => {
                    setFontSize(Number(e.target.value));
                    clearOutput();
                  }}
                  className="mt-3.5 w-full accent-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="watermark-color"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Text Color
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="watermark-color"
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
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Logo / Stamp Image (PNG or JPG)
                </label>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => void handleImageSelect(e)}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="mt-1.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{imageFileName || 'Choose PNG or JPG'}</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="watermark-img-scale"
                    className="text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Width (% of Page)
                  </label>
                  <span className="font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                    {scalePercent}%
                  </span>
                </div>
                <input
                  id="watermark-img-scale"
                  type="range"
                  min={10}
                  max={75}
                  step={5}
                  value={scalePercent}
                  onChange={(e) => {
                    setScalePercent(Number(e.target.value));
                    clearOutput();
                  }}
                  className="mt-3.5 w-full accent-blue-600"
                />
              </div>
            </div>
          )}

          {/* Shared Placement, Opacity & Pages */}
          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
            <div>
              <label
                htmlFor="watermark-placement"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Placement
              </label>
              <select
                id="watermark-placement"
                value={placement}
                onChange={(e) => {
                  setPlacement(e.target.value as WatermarkPlacement);
                  clearOutput();
                }}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="diagonal">Diagonal Across Center</option>
                <option value="center">Horizontal Center</option>
                <option value="tiled">Tiled Pattern Grid</option>
                <option value="top-right">Top Right Corner</option>
                <option value="bottom-right">Bottom Right Corner</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="watermark-opacity"
                  className="text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Opacity
                </label>
                <span className="font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                  {opacityPct}%
                </span>
              </div>
              <input
                id="watermark-opacity"
                type="range"
                min={5}
                max={100}
                step={5}
                value={opacityPct}
                onChange={(e) => {
                  setOpacityPct(Number(e.target.value));
                  clearOutput();
                }}
                className="mt-3.5 w-full accent-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="watermark-pages-mode"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Target Pages
              </label>
              <select
                id="watermark-pages-mode"
                value={targetMode}
                onChange={(e) => {
                  setTargetMode(e.target.value as 'all' | 'range');
                  clearOutput();
                }}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">All Pages ({sourcePdf.pageCount})</option>
                <option value="range">Custom Page Range</option>
              </select>
            </div>
          </div>

          {targetMode === 'range' && (
            <div>
              <input
                type="text"
                aria-label="Pages to watermark"
                value={rangeInput}
                onChange={(e) => {
                  setRangeInput(e.target.value);
                  clearOutput();
                }}
                placeholder="e.g., 1-3, 5"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {!pagePlan.valid && pagePlan.error && (
                <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {pagePlan.error}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={!pagePlan.valid || isApplying || isLoadingFile}
              onClick={() => void handleApply()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Stamp className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isApplying ? 'Applying Watermark...' : 'Add Watermark'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p>
          Text and logo watermarks are stamped directly inside your browser memory without uploading
          PDFs or images.
        </p>
      </div>
    </div>
  );
}
