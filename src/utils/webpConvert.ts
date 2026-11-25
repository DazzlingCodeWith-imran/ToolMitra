import {
  clampWebpQuality,
  computeSizeDifference,
  formatSourceMimeLabel,
  hasValidImageMagicBytes,
  validateImageFileForWebp,
  type SizeDifferenceSummary,
  type SupportedWebpSourceMime,
} from '@/src/utils/imageToWebp';

export type WebpTargetOutputMime = 'image/png' | 'image/jpeg';

export interface ConvertedRasterResult {
  blob: Blob;
  width: number;
  height: number;
  sourceMime: SupportedWebpSourceMime;
  outputMime: WebpTargetOutputMime;
  qualityUsed: number;
  hasTransparency: boolean;
  sizeDiff: SizeDifferenceSummary;
}

export function normalizeHexBackground(hex: string): string {
  const clean = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean : '#FFFFFF';
}

export function buildConvertedImageFilename(
  originalName: string,
  outputMime: WebpTargetOutputMime,
): string {
  const ext = outputMime === 'image/png' ? 'png' : 'jpg';
  const trimmed = originalName.trim().replace(/\.[^.]+$/, '');
  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = sanitized || 'image';
  return `${base}.${ext}`;
}

function detectCanvasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function decodeImageSource(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
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
      reject(new Error('Could not decode this image file. The file may be corrupted.'));
    };
    img.src = url;
  });
}

/**
 * Converts a WebP, PNG, or JPG File to lossless PNG or JPG locally in HTML5 Canvas.
 * For PNG outputs, alpha transparency is preserved cleanly; for JPG outputs,
 * transparent areas are flattened onto the selected background color.
 */
export async function convertImageToPngOrJpg(
  file: File,
  options: {
    outputMime: WebpTargetOutputMime;
    jpgQuality: number;
    jpgBackgroundHex: string;
  },
): Promise<ConvertedRasterResult> {
  const validation = validateImageFileForWebp(file);
  if (!validation.valid || !validation.mime) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  const headerBuf = await file.slice(0, 16).arrayBuffer();
  if (!hasValidImageMagicBytes(new Uint8Array(headerBuf), validation.mime)) {
    throw new Error(
      `"${file.name}" does not match a valid ${formatSourceMimeLabel(validation.mime)} header.`,
    );
  }

  const qualityUsed =
    options.outputMime === 'image/png' ? 100 : Math.max(10, clampWebpQuality(options.jpgQuality));
  const bgHex = normalizeHexBackground(options.jpgBackgroundHex);

  const decoded = await decodeImageSource(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, decoded.width);
    canvas.height = Math.max(1, decoded.height);

    const ctx = canvas.getContext('2d', { alpha: options.outputMime === 'image/png' });
    if (!ctx) {
      throw new Error('Browser Canvas 2D context is unavailable.');
    }

    let hasTransparency = false;

    if (options.outputMime === 'image/jpeg') {
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      decoded.draw(ctx, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      decoded.draw(ctx, canvas.width, canvas.height);
      if (validation.mime === 'image/png' || validation.mime === 'image/webp') {
        hasTransparency = detectCanvasAlpha(ctx, canvas.width, canvas.height);
      }
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Browser Canvas failed to encode the target image format.'));
            return;
          }
          resolve(result);
        },
        options.outputMime,
        options.outputMime === 'image/png' ? undefined : qualityUsed / 100,
      );
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      sourceMime: validation.mime,
      outputMime: options.outputMime,
      qualityUsed,
      hasTransparency,
      sizeDiff: computeSizeDifference(file.size, blob.size),
    };
  } finally {
    decoded.cleanup();
  }
}
