import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  RotateCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  applyScanFilterToRgba,
  buildPdfFromScanImages,
  MAX_SCAN_IMAGE_BYTES,
  MAX_SCAN_IMAGES,
  type ScanFilterPreset,
  type ScanImageItem,
  type ScanPageSize,
} from '@/src/utils/pdfScan';

interface ScanQueueItem {
  id: string;
  name: string;
  originalSize: number;
  previewUrl: string;
  rawUrl: string;
  filter: ScanFilterPreset;
  rotationDeg: number;
}

interface ScanOutput {
  url: string;
  filename: string;
  size: number;
  pageCount: number;
}

const ACCEPTED_SCAN_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function renderScanItemToBytes(item: ScanQueueItem): Promise<ScanImageItem> {
  const img = new Image();
  img.src = item.rawUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Could not decode "${item.name}".`));
  });

  // Cap largest dimension cleanly at 2200px to avoid mobile browser OOM while keeping sharp 200+ DPI text
  const maxDim = 2200;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser Canvas 2D context unavailable.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  if (item.filter !== 'original') {
    const imgData = ctx.getImageData(0, 0, w, h);
    const filtered = applyScanFilterToRgba(imgData.data, item.filter);
    imgData.data.set(filtered);
    ctx.putImageData(imgData, 0, 0);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(`Could not encode "${item.name}".`))),
      'image/jpeg',
      0.88,
    );
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes,
    mimeType: 'image/jpeg',
    rotationDeg: item.rotationDeg,
  };
}

export function ScanToPdfTool() {
  const [items, setItems] = useState<ScanQueueItem[]>([]);
  const [globalFilter, setGlobalFilter] = useState<ScanFilterPreset>('document-bw');
  const [pageSize, setPageSize] = useState<ScanPageSize>('a4');
  const [marginPt, setMarginPt] = useState<number>(20);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<ScanOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  const clearOutput = () => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
    setOutput(null);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    clearOutput();
    setErrorMessage(null);

    const incoming = Array.from(fileList);
    if (items.length + incoming.length > MAX_SCAN_IMAGES) {
      setErrorMessage(`Up to ${MAX_SCAN_IMAGES} scanned pages can be combined in one PDF.`);
      return;
    }

    const nextItems: ScanQueueItem[] = [];
    for (const file of incoming) {
      const lower = file.name.toLowerCase();
      const validType =
        ACCEPTED_SCAN_MIME.has(file.type) ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp');
      if (!validType) {
        setErrorMessage(`"${file.name}" is not a supported photo format (JPG, PNG, WebP).`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_SCAN_IMAGE_BYTES) {
        setErrorMessage(`"${file.name}" must be between 1 byte and 20 MB.`);
        continue;
      }
      const rawUrl = URL.createObjectURL(file);
      createdUrlsRef.current.push(rawUrl);
      nextItems.push({
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        originalSize: file.size,
        previewUrl: rawUrl,
        rawUrl,
        filter: globalFilter,
        rotationDeg: 0,
      });
    }

    if (nextItems.length > 0) {
      setItems((prev) => [...prev, ...nextItems]);
    }
  };

  const openWebcam = async () => {
    setErrorMessage(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      // Fall back cleanly to native mobile camera file picker if webcam permission is blocked/unavailable
      cameraInputRef.current?.click();
    }
  };

  const captureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMessage('Camera feed is still initializing. Try capturing again in a second.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        createdUrlsRef.current.push(url);
        setItems((prev) => [
          ...prev,
          {
            id: `cam-${Date.now()}`,
            name: `Camera Scan ${prev.length + 1}.jpg`,
            originalSize: blob.size,
            previewUrl: url,
            rawUrl: url,
            filter: globalFilter,
            rotationDeg: 0,
          },
        ]);
        clearOutput();
      },
      'image/jpeg',
      0.92,
    );
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    clearOutput();
  };

  const handleBuildPdf = async () => {
    if (items.length === 0) {
      setErrorMessage('Upload or capture at least one document photo first.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsBuilding(true);
    setStatusMessage('Enhancing scanned pages...');

    try {
      const processed: ScanImageItem[] = [];
      for (let i = 0; i < items.length; i++) {
        setStatusMessage(`Applying scan filter to page ${i + 1} of ${items.length}...`);
        processed.push(await renderScanItemToBytes(items[i]));
      }

      const result = await buildPdfFromScanImages(
        processed,
        { pageSize, marginPt },
        (msg) => setStatusMessage(msg),
      );

      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        url,
        filename: `toolmitra-scanned-${new Date().toISOString().slice(0, 10)}.pdf`,
        size: blob.size,
        pageCount: result.pageCount,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create scanned PDF.');
      setStatusMessage(null);
    } finally {
      setIsBuilding(false);
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
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="scan-files-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <FileUp className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drop document photos here or capture directly from your camera
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to 30 photos (JPG, PNG, WebP) · Document B&amp;W cleanup, grayscale &amp; contrast boost
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isBuilding}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Select Photos
          </button>
          <button
            type="button"
            disabled={isBuilding}
            onClick={() => void openWebcam()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span>Capture via Camera</span>
          </button>
        </div>
      </div>

      {isCameraOpen && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Camera Capture
            </p>
            <button
              type="button"
              onClick={stopCamera}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400"
            >
              Close camera
            </button>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="mx-auto max-h-72 w-full rounded-lg bg-slate-950 object-contain"
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={captureCameraFrame}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>Snap Document Page</span>
            </button>
          </div>
        </div>
      )}

      {(isBuilding || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Building scanned PDF...'}</p>
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
                Scanned PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                {output.pageCount} {output.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Scanned PDF</span>
          </a>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="scan-global-filter"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Scan Enhancement Filter
              </label>
              <select
                id="scan-global-filter"
                value={globalFilter}
                onChange={(e) => {
                  const preset = e.target.value as ScanFilterPreset;
                  setGlobalFilter(preset);
                  setItems((prev) => prev.map((it) => ({ ...it, filter: preset })));
                  clearOutput();
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="document-bw">Document B&amp;W (Crisp Paper)</option>
                <option value="grayscale">Grayscale</option>
                <option value="contrast">Color Contrast Boost</option>
                <option value="original">Original Photo</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="scan-page-size"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Page Size
              </label>
              <select
                id="scan-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value as ScanPageSize);
                  clearOutput();
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="a4">A4 (Standard)</option>
                <option value="letter">US Letter</option>
                <option value="fit">Fit to Photo Aspect</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="scan-margin"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Margin ({marginPt} pt)
              </label>
              <input
                id="scan-margin"
                type="range"
                min={0}
                max={48}
                step={4}
                value={marginPt}
                onChange={(e) => {
                  setMarginPt(Number(e.target.value));
                  clearOutput();
                }}
                className="mt-3 w-full accent-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    style={{
                      transform: `rotate(${item.rotationDeg}deg)`,
                      filter:
                        item.filter === 'document-bw'
                          ? 'grayscale(100%) contrast(165%) brightness(106%)'
                          : item.filter === 'grayscale'
                            ? 'grayscale(100%)'
                            : item.filter === 'contrast'
                              ? 'contrast(130%)'
                              : 'none',
                    }}
                    className="max-h-full max-w-full object-contain transition-transform"
                  />
                  <span className="absolute top-2 left-2 rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                    #{idx + 1}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                    {item.name}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Rotate ${item.name} 90 degrees`}
                      onClick={() => {
                        setItems((prev) =>
                          prev.map((it) =>
                            it.id === item.id
                              ? { ...it, rotationDeg: (it.rotationDeg + 90) % 360 }
                              : it,
                          ),
                        );
                        clearOutput();
                      }}
                      className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label={`Move ${item.name} up`}
                      onClick={() => moveItem(idx, -1)}
                      className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      aria-label={`Move ${item.name} down`}
                      onClick={() => moveItem(idx, 1)}
                      className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => {
                        setItems((prev) => prev.filter((it) => it.id !== item.id));
                        clearOutput();
                      }}
                      className="rounded border border-slate-200 bg-white p-1 text-slate-500 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={isBuilding}
            onClick={() => void handleBuildPdf()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:w-auto dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
          >
            {isBuilding ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {isBuilding ? 'Building PDF...' : `Create Scanned PDF (${items.length} Pages)`}
            </span>
          </button>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Camera frames and uploaded document photos are filtered on your browser canvas and
          assembled into a PDF locally without ever sending images to an external server.
        </p>
      </div>
    </div>
  );
}
