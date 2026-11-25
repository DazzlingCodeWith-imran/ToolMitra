import {
  clampWebpQuality,
  computeSizeDifference,
  formatSourceMimeLabel,
  hasValidImageMagicBytes,
  validateImageFileForWebp,
  type SizeDifferenceSummary,
  type SupportedWebpSourceMime,
} from '@/src/utils/imageToWebp';

export type CropAspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:4';
export type CropOutputFormat = 'keep' | SupportedWebpSourceMime;
export type CropRotationDeg = 0 | 90 | 180 | 270;

export interface CropPercentBox {
  xPct: number; // 0..95
  yPct: number; // 0..95
  widthPct: number; // 5..100
  heightPct: number; // 5..100
}

export interface PixelCropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  transformedWidth: number;
  transformedHeight: number;
}

export interface CroppedImageResult {
  blob: Blob;
  width: number;
  height: number;
  sourceMime: SupportedWebpSourceMime;
  outputMime: SupportedWebpSourceMime;
  sizeDiff: SizeDifferenceSummary;
}

export function normalizeCropPercentBox(box: CropPercentBox): CropPercentBox {
  const xPct = Number.isFinite(box.xPct) ? Math.min(95, Math.max(0, Math.round(box.xPct))) : 0;
  const yPct = Number.isFinite(box.yPct) ? Math.min(95, Math.max(0, Math.round(box.yPct))) : 0;
  const maxWidth = 100 - xPct;
  const maxHeight = 100 - yPct;
  const widthPct = Number.isFinite(box.widthPct)
    ? Math.min(maxWidth, Math.max(5, Math.round(box.widthPct)))
    : maxWidth;
  const heightPct = Number.isFinite(box.heightPct)
    ? Math.min(maxHeight, Math.max(5, Math.round(box.heightPct)))
    : maxHeight;
  return { xPct, yPct, widthPct, heightPct };
}

export function getOrientedDimensions(
  naturalWidth: number,
  naturalHeight: number,
  rotationDeg: CropRotationDeg,
): { width: number; height: number } {
  if (rotationDeg === 90 || rotationDeg === 270) {
    return { width: naturalHeight, height: naturalWidth };
  }
  return { width: naturalWidth, height: naturalHeight };
}

export function computePresetCropBox(
  orientedWidth: number,
  orientedHeight: number,
  preset: CropAspectPreset,
): CropPercentBox {
  if (preset === 'free' || orientedWidth <= 0 || orientedHeight <= 0) {
    return { xPct: 5, yPct: 5, widthPct: 90, heightPct: 90 };
  }

  const ratioMap: Record<Exclude<CropAspectPreset, 'free'>, number> = {
    '1:1': 1,
    '4:3': 4 / 3,
    '16:9': 16 / 9,
    '3:4': 3 / 4,
  };

  const targetRatio = ratioMap[preset];
  const imgRatio = orientedWidth / orientedHeight;

  let widthPct: number;
  let heightPct: number;

  if (imgRatio >= targetRatio) {
    heightPct = 88;
    widthPct = Math.max(5, Math.min(96, Math.round((heightPct * targetRatio) / imgRatio)));
  } else {
    widthPct = 88;
    heightPct = Math.max(5, Math.min(96, Math.round((widthPct * imgRatio) / targetRatio)));
  }

  const xPct = Math.max(0, Math.round((100 - widthPct) / 2));
  const yPct = Math.max(0, Math.round((100 - heightPct) / 2));

  return normalizeCropPercentBox({ xPct, yPct, widthPct, heightPct });
}

export function computePixelCropRect(
  naturalWidth: number,
  naturalHeight: number,
  rotationDeg: CropRotationDeg,
  box: CropPercentBox,
): PixelCropRect {
  const oriented = getOrientedDimensions(naturalWidth, naturalHeight, rotationDeg);
  const safeBox = normalizeCropPercentBox(box);

  const sx = Math.max(0, Math.min(oriented.width - 1, Math.round((safeBox.xPct / 100) * oriented.width)));
  const sy = Math.max(0, Math.min(oriented.height - 1, Math.round((safeBox.yPct / 100) * oriented.height)));
  const sw = Math.max(1, Math.min(oriented.width - sx, Math.round((safeBox.widthPct / 100) * oriented.width)));
  const sh = Math.max(1, Math.min(oriented.height - sy, Math.round((safeBox.heightPct / 100) * oriented.height)));

  return {
    sx,
    sy,
    sw,
    sh,
    transformedWidth: oriented.width,
    transformedHeight: oriented.height,
  };
}

export function buildCroppedFilename(
  originalName: string,
  outputMime: SupportedWebpSourceMime,
): string {
  const ext = outputMime === 'image/png' ? 'png' : outputMime === 'image/webp' ? 'webp' : 'jpg';
  const trimmed = originalName.trim().replace(/\.[^.]+$/, '');
  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${sanitized || 'image'}-cropped.${ext}`;
}

async function decodeCropSource(file: File): Promise<{
  width: number;
  height: number;
  drawRaw: (ctx: CanvasRenderingContext2D) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      drawRaw: (ctx) => ctx.drawImage(bitmap, 0, 0),
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
        drawRaw: (ctx) => ctx.drawImage(img, 0, 0),
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

export async function cropAndTransformImageFile(
  file: File,
  options: {
    cropBox: CropPercentBox;
    rotationDeg: CropRotationDeg;
    flipHorizontal: boolean;
    flipVertical: boolean;
    outputFormat: CropOutputFormat;
    quality: number;
  },
): Promise<CroppedImageResult> {
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
  const safeQuality = Math.max(10, clampWebpQuality(options.quality));

  const decoded = await decodeCropSource(file);
  try {
    const rect = computePixelCropRect(
      decoded.width,
      decoded.height,
      options.rotationDeg,
      options.cropBox,
    );

    // Step 1: Render rotated/flipped image onto an intermediate oriented canvas
    const stageCanvas = document.createElement('canvas');
    stageCanvas.width = rect.transformedWidth;
    stageCanvas.height = rect.transformedHeight;
    const stageCtx = stageCanvas.getContext('2d', { alpha: true });
    if (!stageCtx) {
      throw new Error('Browser Canvas 2D context is unavailable.');
    }

    stageCtx.save();
    stageCtx.translate(stageCanvas.width / 2, stageCanvas.height / 2);
    stageCtx.rotate((options.rotationDeg * Math.PI) / 180);
    stageCtx.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
    stageCtx.translate(-decoded.width / 2, -decoded.height / 2);
    decoded.drawRaw(stageCtx);
    stageCtx.restore();

    // Step 2: Copy cropped rectangle onto final output canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = rect.sw;
    outCanvas.height = rect.sh;
    const outCtx = outCanvas.getContext('2d', { alpha: targetMime !== 'image/jpeg' });
    if (!outCtx) {
      throw new Error('Browser Canvas 2D output context is unavailable.');
    }

    if (targetMime === 'image/jpeg') {
      outCtx.fillStyle = '#FFFFFF';
      outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    } else {
      outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    }

    outCtx.drawImage(stageCanvas, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh);

    const blob = await new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Browser Canvas failed to encode the cropped image.'));
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
      width: outCanvas.width,
      height: outCanvas.height,
      sourceMime: validation.mime,
      outputMime: targetMime,
      sizeDiff: computeSizeDifference(file.size, blob.size),
    };
  } finally {
    decoded.cleanup();
  }
}
