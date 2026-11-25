import {
  clampWebpQuality,
  computeSizeDifference,
  formatSourceMimeLabel,
  hasValidImageMagicBytes,
  validateImageFileForWebp,
  type SizeDifferenceSummary,
  type SupportedWebpSourceMime,
} from '@/src/utils/imageToWebp';

export type ResizeOutputFormat = 'keep' | SupportedWebpSourceMime;

export const MIN_RESIZE_DIMENSION_PX = 16;
export const MAX_RESIZE_DIMENSION_PX = 8192;

export interface ResizedImageResult {
  blob: Blob;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  sourceMime: SupportedWebpSourceMime;
  outputMime: SupportedWebpSourceMime;
  sizeDiff: SizeDifferenceSummary;
}

export function clampResizeDimension(value: number, fallback = 800): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_RESIZE_DIMENSION_PX, Math.max(MIN_RESIZE_DIMENSION_PX, Math.round(value)));
}

export function computeAspectLockedDimensions(params: {
  originalWidth: number;
  originalHeight: number;
  changedAxis: 'width' | 'height';
  nextValue: number;
}): { width: number; height: number } {
  const safeOrigW = Math.max(1, params.originalWidth);
  const safeOrigH = Math.max(1, params.originalHeight);
  const clamped = clampResizeDimension(params.nextValue, params.changedAxis === 'width' ? safeOrigW : safeOrigH);

  if (params.changedAxis === 'width') {
    const ratio = clamped / safeOrigW;
    return {
      width: clamped,
      height: clampResizeDimension(Math.round(safeOrigH * ratio), safeOrigH),
    };
  }

  const ratio = clamped / safeOrigH;
  return {
    width: clampResizeDimension(Math.round(safeOrigW * ratio), safeOrigW),
    height: clamped,
  };
}

export function computeScaledDimensions(
  originalWidth: number,
  originalHeight: number,
  scalePercent: number,
): { width: number; height: number } {
  const safePct = Number.isFinite(scalePercent) ? Math.min(200, Math.max(10, scalePercent)) : 100;
  const factor = safePct / 100;
  return {
    width: clampResizeDimension(Math.round(originalWidth * factor), originalWidth),
    height: clampResizeDimension(Math.round(originalHeight * factor), originalHeight),
  };
}

export function buildResizedFilename(
  originalName: string,
  width: number,
  height: number,
  outputMime: SupportedWebpSourceMime,
): string {
  const ext = outputMime === 'image/png' ? 'png' : outputMime === 'image/webp' ? 'webp' : 'jpg';
  const trimmed = originalName.trim().replace(/\.[^.]+$/, '');
  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = sanitized || 'image';
  return `${base}-${width}x${height}.${ext}`;
}

async function decodeImageForResize(file: File): Promise<{
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
      reject(new Error('Could not decode this image file.'));
    };
    img.src = url;
  });
}

export async function inspectImageDimensions(file: File): Promise<{
  width: number;
  height: number;
  mime: SupportedWebpSourceMime;
}> {
  const validation = validateImageFileForWebp(file);
  if (!validation.valid || !validation.mime) {
    throw new Error(validation.error || 'Unsupported image file.');
  }
  const headerBuf = await file.slice(0, 16).arrayBuffer();
  if (!hasValidImageMagicBytes(new Uint8Array(headerBuf), validation.mime)) {
    throw new Error(
      `"${file.name}" does not match a valid ${formatSourceMimeLabel(validation.mime)} file.`,
    );
  }
  const decoded = await decodeImageForResize(file);
  try {
    return {
      width: decoded.width,
      height: decoded.height,
      mime: validation.mime,
    };
  } finally {
    decoded.cleanup();
  }
}

export async function resizeImageFile(
  file: File,
  options: {
    width: number;
    height: number;
    outputFormat: ResizeOutputFormat;
    quality: number;
  },
): Promise<ResizedImageResult> {
  const validation = validateImageFileForWebp(file);
  if (!validation.valid || !validation.mime) {
    throw new Error(validation.error || 'Unsupported image file.');
  }
  const headerBuf = await file.slice(0, 16).arrayBuffer();
  if (!hasValidImageMagicBytes(new Uint8Array(headerBuf), validation.mime)) {
    throw new Error(
      `"${file.name}" does not match a valid ${formatSourceMimeLabel(validation.mime)} file.`,
    );
  }

  const targetMime: SupportedWebpSourceMime =
    options.outputFormat === 'keep' ? validation.mime : options.outputFormat;
  const targetWidth = clampResizeDimension(options.width);
  const targetHeight = clampResizeDimension(options.height);
  const safeQuality = Math.max(10, clampWebpQuality(options.quality));

  const decoded = await decodeImageForResize(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { alpha: targetMime !== 'image/jpeg' });
    if (!ctx) {
      throw new Error('Browser Canvas 2D context is unavailable.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    }

    decoded.draw(ctx, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Browser Canvas failed to export the resized image.'));
            return;
          }
          if (targetMime === 'image/webp' && result.type && result.type !== 'image/webp') {
            reject(new Error('Your browser does not support WebP Canvas encoding.'));
            return;
          }
          resolve(result);
        },
        targetMime,
        targetMime === 'image/png' ? undefined : safeQuality / 100,
      );
    });

    return {
      blob,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
      targetWidth,
      targetHeight,
      sourceMime: validation.mime,
      outputMime: targetMime,
      sizeDiff: computeSizeDifference(file.size, blob.size),
    };
  } finally {
    decoded.cleanup();
  }
}
