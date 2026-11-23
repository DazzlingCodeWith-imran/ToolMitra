import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileDown,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';

type PageSize = 'a4' | 'letter' | 'fit';
type Orientation = 'auto' | 'portrait' | 'landscape';

interface PdfImageItem {
  id: string;
  file: File;
  previewUrl: string;
  size: number;
}

const MAX_FILES = 30;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function renderImageToDataUrl(
  file: File,
): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG'; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable.');
    }

    const usePng = file.type === 'image/png';
    if (!usePng) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);

    const mime = usePng ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, usePng ? undefined : 0.92);
    return {
      dataUrl,
      format: usePng ? 'PNG' : 'JPEG',
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

export function JpgToPdfTool() {
  const [images, setImages] = useState<PdfImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [marginMm, setMarginMm] = useState<number>(10);
  const [fileName, setFileName] = useState<string>('toolmitra-document');
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<PdfImageItem[]>([]);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      for (const item of imagesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const incoming = Array.from(fileList);
    const remaining = MAX_FILES - images.length;
    if (remaining <= 0) {
      setErrorMessage(`Maximum ${MAX_FILES} images allowed per PDF.`);
      return;
    }

    const rejected: string[] = [];
    const accepted: PdfImageItem[] = [];

    const isAllowedImage = (file: File): boolean => {
      if (ALLOWED_TYPES.has(file.type)) return true;
      const lower = file.name.toLowerCase();
      return (
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp')
      );
    };

    for (const file of incoming) {
      if (accepted.length >= remaining) {
        rejected.push(`${file.name} (exceeds ${MAX_FILES}-image limit)`);
        continue;
      }
      if (!isAllowedImage(file)) {
        rejected.push(`${file.name} (use JPG, PNG, or WebP)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (exceeds 20 MB limit)`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        size: file.size,
      });
    }

    if (rejected.length > 0) {
      setErrorMessage(`Skipped ${rejected.length} file(s): ${rejected.join('; ')}`);
    }

    if (accepted.length > 0) {
      setImages((prev) => [...prev, ...accepted]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    setImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  const removeItem = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    for (const item of images) {
      URL.revokeObjectURL(item.previewUrl);
    }
    setImages([]);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) {
      setErrorMessage('Please add at least one image before generating a PDF.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { jsPDF } = await import('jspdf');
      let doc: InstanceType<typeof jsPDF> | null = null;

      for (let idx = 0; idx < images.length; idx++) {
        const rendered = await renderImageToDataUrl(images[idx].file);
        const isWide = rendered.width >= rendered.height;
        const pageOrientation: 'portrait' | 'landscape' =
          orientation === 'auto' ? (isWide ? 'landscape' : 'portrait') : orientation;

        if (pageSize === 'fit') {
          // Convert pixels to mm at 96 DPI (1 px ≈ 0.264583 mm)
          const pxToMm = 25.4 / 96;
          const imgWmm = Math.max(20, rendered.width * pxToMm);
          const imgHmm = Math.max(20, rendered.height * pxToMm);
          const pageW = imgWmm + marginMm * 2;
          const pageH = imgHmm + marginMm * 2;
          const fitOrientation = pageW >= pageH ? 'landscape' : 'portrait';

          if (!doc) {
            doc = new jsPDF({
              orientation: fitOrientation,
              unit: 'mm',
              format: [pageW, pageH],
            });
          } else {
            doc.addPage([pageW, pageH], fitOrientation);
          }

          doc.addImage(rendered.dataUrl, rendered.format, marginMm, marginMm, imgWmm, imgHmm);
        } else {
          if (!doc) {
            doc = new jsPDF({
              orientation: pageOrientation,
              unit: 'mm',
              format: pageSize,
            });
          } else {
            doc.addPage(pageSize, pageOrientation);
          }

          const pageW = doc.internal.pageSize.getWidth();
          const pageH = doc.internal.pageSize.getHeight();
          const availW = Math.max(10, pageW - marginMm * 2);
          const availH = Math.max(10, pageH - marginMm * 2);

          const scale = Math.min(availW / rendered.width, availH / rendered.height);
          const drawW = rendered.width * scale;
          const drawH = rendered.height * scale;
          const offsetX = (pageW - drawW) / 2;
          const offsetY = (pageH - drawH) / 2;

          doc.addImage(rendered.dataUrl, rendered.format, offsetX, offsetY, drawW, drawH);
        }
      }

      if (!doc) {
        throw new Error('No pages were created.');
      }

      const cleanBase =
        fileName
          .trim()
          .replace(/\.pdf$/i, '')
          .replace(/[^a-zA-Z0-9_-]+/g, '-') || 'toolmitra-document';
      const pdfBlob = doc.output('blob');
      doc.save(`${cleanBase}.pdf`);
      setSuccessMessage(
        `Created ${cleanBase}.pdf with ${images.length} ${images.length === 1 ? 'page' : 'pages'} (${formatBytes(pdfBlob.size)}).`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to build PDF. Please check your image files.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PDF Settings */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="pdf-page-size"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Page Size
            </label>
            <select
              id="pdf-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="a4">A4 (210 × 297 mm)</option>
              <option value="letter">US Letter (8.5 × 11 in)</option>
              <option value="fit">Fit Page to Each Image</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pdf-orientation"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Orientation
            </label>
            <select
              id="pdf-orientation"
              value={orientation}
              disabled={pageSize === 'fit'}
              onChange={(e) => setOrientation(e.target.value as Orientation)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="auto">Auto (Match Image)</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pdf-margin"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Page Margin
            </label>
            <select
              id="pdf-margin"
              value={marginMm}
              onChange={(e) => setMarginMm(Number(e.target.value))}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value={0}>No Margin (0 mm)</option>
              <option value={10}>Small (10 mm)</option>
              <option value={20}>Medium (20 mm)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pdf-filename"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Output Filename
            </label>
            <input
              id="pdf-filename"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="toolmitra-document"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
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
          id="jpg-to-pdf-input"
        />
        <ImagePlus
          className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Drop JPG, PNG, or WebP images to combine into a PDF
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to 30 images per PDF, max 20 MB each. All pages are assembled locally.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Add Images
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

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Queue & Generate Action */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Page Order ({images.length} {images.length === 1 ? 'image' : 'images'})
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Clear</span>
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGeneratePdf}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileDown className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isGenerating ? 'Building PDF...' : 'Convert & Download PDF'}</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {images.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="w-6 shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                    {idx + 1}.
                  </span>
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-800"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.file.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatBytes(item.size)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, -1)}
                    aria-label={`Move ${item.file.name} up`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveItem(idx, 1)}
                    aria-label={`Move ${item.file.name} down`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
