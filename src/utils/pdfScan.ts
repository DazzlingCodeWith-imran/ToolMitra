export type ScanFilterPreset = 'original' | 'document-bw' | 'grayscale' | 'contrast';
export type ScanPageSize = 'a4' | 'letter' | 'fit';

export interface ScanImageItem {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
  rotationDeg?: number;
}

export const MAX_SCAN_IMAGES = 30;
export const MAX_SCAN_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB per scan

/**
 * Pure RGBA pixel filter for scanned documents (high-contrast B&W, grayscale, contrast boost).
 */
export function applyScanFilterToRgba(
  rgba: Uint8ClampedArray,
  preset: ScanFilterPreset,
): Uint8ClampedArray {
  if (preset === 'original') {
    return rgba;
  }

  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    if (preset === 'grayscale') {
      const val = Math.round(luma);
      out[i] = val;
      out[i + 1] = val;
      out[i + 2] = val;
      out[i + 3] = a;
    } else if (preset === 'document-bw') {
      // Adaptive-like boosted threshold tuned for crisp dark ink on bright paper
      const contrasted = (luma - 128) * 1.65 + 135;
      const bw = contrasted >= 132 ? 255 : contrasted <= 65 ? 18 : Math.round(contrasted);
      out[i] = bw;
      out[i + 1] = bw;
      out[i + 2] = bw;
      out[i + 3] = a;
    } else {
      // 'contrast' color preset
      const factor = 1.32;
      out[i] = Math.max(0, Math.min(255, Math.round((r - 128) * factor + 134)));
      out[i + 1] = Math.max(0, Math.min(255, Math.round((g - 128) * factor + 134)));
      out[i + 2] = Math.max(0, Math.min(255, Math.round((b - 128) * factor + 134)));
      out[i + 3] = a;
    }
  }
  return out;
}

export async function buildPdfFromScanImages(
  items: ScanImageItem[],
  options: {
    pageSize: ScanPageSize;
    marginPt: number;
  },
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (items.length === 0) {
    throw new Error('Add at least one scanned photo or document page first.');
  }
  if (items.length > MAX_SCAN_IMAGES) {
    throw new Error(`Maximum ${MAX_SCAN_IMAGES} scanned pages supported per PDF.`);
  }

  onProgress?.('Loading PDF builder...');
  const { PDFDocument, PageSizes, degrees } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const safeMargin = Math.max(0, Math.min(72, options.marginPt));

  for (let i = 0; i < items.length; i++) {
    onProgress?.(`Adding scanned page ${i + 1} of ${items.length}...`);
    const item = items[i];
    const embedded =
      item.mimeType === 'image/png'
        ? await pdfDoc.embedPng(item.bytes)
        : await pdfDoc.embedJpg(item.bytes);

    const rot = (((item.rotationDeg ?? 0) % 360) + 360) % 360;
    const isQuarterTurn = rot === 90 || rot === 270;
    const naturalW = isQuarterTurn ? embedded.height : embedded.width;
    const naturalH = isQuarterTurn ? embedded.width : embedded.height;

    let pageWidth: number;
    let pageHeight: number;
    if (options.pageSize === 'fit') {
      pageWidth = naturalW + safeMargin * 2;
      pageHeight = naturalH + safeMargin * 2;
    } else {
      const base = options.pageSize === 'letter' ? PageSizes.Letter : PageSizes.A4;
      const landscape = naturalW > naturalH;
      pageWidth = landscape ? base[1] : base[0];
      pageHeight = landscape ? base[0] : base[1];
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const availW = Math.max(24, pageWidth - safeMargin * 2);
    const availH = Math.max(24, pageHeight - safeMargin * 2);
    const scale = Math.min(availW / naturalW, availH / naturalH);

    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;

    // Position rotated or upright image centered on the sheet
    let drawX = (pageWidth - drawW) / 2;
    let drawY = (pageHeight - drawH) / 2;
    if (rot === 90) {
      drawX = (pageWidth + drawH) / 2;
      drawY = (pageHeight - drawW) / 2;
    } else if (rot === 180) {
      drawX = (pageWidth + drawW) / 2;
      drawY = (pageHeight + drawH) / 2;
    } else if (rot === 270) {
      drawX = (pageWidth - drawH) / 2;
      drawY = (pageHeight + drawW) / 2;
    }

    page.drawImage(embedded, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
      rotate: rot === 0 ? undefined : degrees(rot),
    });
  }

  onProgress?.('Finalizing scanned PDF...');
  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pdfDoc.getPageCount(),
  };
}
