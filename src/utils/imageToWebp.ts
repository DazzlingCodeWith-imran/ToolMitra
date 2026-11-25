export type SupportedWebpSourceMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const MAX_WEBP_SOURCE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface ImageValidationResult {
  valid: boolean;
  mime: SupportedWebpSourceMime | null;
  error: string | null;
}

export interface SizeDifferenceSummary {
  deltaBytes: number;
  absDeltaBytes: number;
  percentChange: number;
  direction: 'smaller' | 'larger' | 'same';
}

export interface ConvertedWebpResult {
  blob: Blob;
  width: number;
  height: number;
  sourceMime: SupportedWebpSourceMime;
  qualityUsed: number;
  hasTransparency: boolean;
}

/**
 * Clamps quality slider input safely to 0..100 integer range.
 */
export function clampWebpQuality(rawQuality: number): number {
  if (!Number.isFinite(rawQuality)) return 82;
  return Math.min(100, Math.max(0, Math.round(rawQuality)));
}

/**
 * Resolves supported MIME type from File.type or file extension fallback.
 */
export function resolveSupportedImageMime(
  fileName: string,
  mimeType: string,
): SupportedWebpSourceMime | null {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'image/jpeg';
  if (normalized === 'image/png') return 'image/png';
  if (normalized === 'image/webp') return 'image/webp';

  const lowerName = fileName.trim().toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return null;
}

/**
 * Validates file type, non-empty size, and browser memory limits before decoding.
 */
export function validateImageFileForWebp(file: {
  name: string;
  type: string;
  size: number;
}): ImageValidationResult {
  const mime = resolveSupportedImageMime(file.name, file.type);
  if (!mime) {
    return {
      valid: false,
      mime: null,
      error: `Unsupported file "${file.name}". Upload a JPG, JPEG, PNG, or WebP image.`,
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      valid: false,
      mime: null,
      error: `"${file.name}" is empty (0 bytes) and cannot be converted.`,
    };
  }

  if (file.size > MAX_WEBP_SOURCE_BYTES) {
    return {
      valid: false,
      mime: null,
      error: `"${file.name}" exceeds the 25 MB limit for reliable in-browser conversion.`,
    };
  }

  return {
    valid: true,
    mime,
    error: null,
  };
}

/**
 * Checks leading magic bytes to reject renamed non-image files (e.g. text/PDF renamed to .png).
 */
export function hasValidImageMagicBytes(
  bytes: Uint8Array,
  expectedMime: SupportedWebpSourceMime,
): boolean {
  if (expectedMime === 'image/jpeg') {
    return bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (expectedMime === 'image/png') {
    return (
      bytes.byteLength >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  // RIFF....WEBP
  return (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/**
 * Generates a clean .webp download filename without weird characters.
 */
export function buildWebpDownloadFilename(originalName: string): string {
  const trimmed = originalName.trim();
  const isAlreadyWebp = /\.webp$/i.test(trimmed);
  const withoutExt = trimmed.replace(/\.[^.]+$/, '');
  const sanitized = withoutExt
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = sanitized || 'image';
  return isAlreadyWebp ? `${base}-reencoded.webp` : `${base}.webp`;
}

/**
 * Computes exact byte and percentage difference cleanly without claiming output is always smaller.
 */
export function computeSizeDifference(
  originalBytes: number,
  convertedBytes: number,
): SizeDifferenceSummary {
  const safeOriginal = Math.max(0, originalBytes);
  const safeConverted = Math.max(0, convertedBytes);
  const deltaBytes = safeConverted - safeOriginal;
  const absDeltaBytes = Math.abs(deltaBytes);

  if (deltaBytes === 0 || safeOriginal === 0) {
    return {
      deltaBytes: 0,
      absDeltaBytes: 0,
      percentChange: 0,
      direction: 'same',
    };
  }

  const percentChange = Number(((absDeltaBytes / safeOriginal) * 100).toFixed(1));
  return {
    deltaBytes,
    absDeltaBytes,
    percentChange,
    direction: deltaBytes < 0 ? 'smaller' : 'larger',
  };
}

export function formatSourceMimeLabel(mime: SupportedWebpSourceMime): string {
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/webp') return 'WebP';
  return 'JPG';
}

function detectCanvasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const pixelData = ctx.getImageData(0, 0, width, height).data;
    // Check alpha byte (index + 3) across pixels; fast exit on first semi/full-transparent pixel
    for (let i = 3; i < pixelData.length; i += 4) {
      if (pixelData[i] < 255) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function decodeBrowserImage(file: File): Promise<{
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
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode this image file. The file may be corrupted.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Converts a single validated JPG, PNG, or WebP File to WebP locally via HTML5 Canvas,
 * preserving alpha transparency when the source image contains transparent pixels.
 */
export async function convertImageFileToWebp(
  file: File,
  rawQuality: number,
): Promise<ConvertedWebpResult> {
  const validation = validateImageFileForWebp(file);
  if (!validation.valid || !validation.mime) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  const headerSlice = await file.slice(0, 16).arrayBuffer();
  const headerBytes = new Uint8Array(headerSlice);
  if (!hasValidImageMagicBytes(headerBytes, validation.mime)) {
    throw new Error(
      `"${file.name}" does not appear to be a valid ${formatSourceMimeLabel(validation.mime)} file.`,
    );
  }

  const qualityUsed = clampWebpQuality(rawQuality);
  const decoded = await decodeBrowserImage(file);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, decoded.width);
    canvas.height = Math.max(1, decoded.height);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Browser Canvas 2D context is unavailable.');
    }

    // Clear canvas transparently (never fill solid white) so PNG/WebP alpha channels remain intact
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    decoded.draw(ctx, canvas.width, canvas.height);

    const hasTransparency =
      validation.mime === 'image/png' || validation.mime === 'image/webp'
        ? detectCanvasTransparency(ctx, canvas.width, canvas.height)
        : false;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Browser Canvas failed to encode this image as WebP.'));
            return;
          }
          if (result.type && result.type !== 'image/webp') {
            reject(
              new Error(
                'Your current browser does not support WebP Canvas encoding. Try a recent version of Chrome, Edge, Firefox, or Safari.',
              ),
            );
            return;
          }
          resolve(result);
        },
        'image/webp',
        qualityUsed / 100,
      );
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      sourceMime: validation.mime,
      qualityUsed,
      hasTransparency,
    };
  } finally {
    decoded.cleanup();
  }
}
