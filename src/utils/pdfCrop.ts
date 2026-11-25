import { hasPdfSignature } from '@/src/utils/pdfMerge';

export const MAX_CROP_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface CropPercentMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  croppedPageCount: number;
}

export function validateCropMargins(margins: CropPercentMargins): string | null {
  const values = [margins.top, margins.right, margins.bottom, margins.left];
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0 || v > 45) {
      return 'Each crop margin must be between 0% and 45%.';
    }
  }
  if (margins.left + margins.right >= 90) {
    return 'Combined left and right crop cannot reach or exceed 90% of page width.';
  }
  if (margins.top + margins.bottom >= 90) {
    return 'Combined top and bottom crop cannot reach or exceed 90% of page height.';
  }
  if (margins.top === 0 && margins.right === 0 && margins.bottom === 0 && margins.left === 0) {
    return 'Adjust at least one margin above 0% before cropping.';
  }
  return null;
}

export async function cropPdfPages(
  sourceBytes: Uint8Array,
  margins: CropPercentMargins,
  targetPageNumbers: number[] | 'all',
  onProgress?: (message: string) => void,
): Promise<CropPdfResult> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  const marginError = validateCropMargins(margins);
  if (marginError) {
    throw new Error(marginError);
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before cropping.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const pages = pdfDoc.getPages();
  const targetSet =
    targetPageNumbers === 'all' ? null : new Set<number>(targetPageNumbers);

  let croppedPageCount = 0;
  onProgress?.('Applying page crop boxes...');

  for (let i = 0; i < pages.length; i++) {
    const pageNumber = i + 1;
    if (targetSet && !targetSet.has(pageNumber)) continue;

    const page = pages[i];
    const box = page.getCropBox() || page.getMediaBox();

    const cropLeft = (box.width * margins.left) / 100;
    const cropRight = (box.width * margins.right) / 100;
    const cropBottom = (box.height * margins.bottom) / 100;
    const cropTop = (box.height * margins.top) / 100;

    const newWidth = box.width - cropLeft - cropRight;
    const newHeight = box.height - cropBottom - cropTop;

    if (newWidth < 12 || newHeight < 12) {
      throw new Error(`Crop margins leave page ${pageNumber} too small to display.`);
    }

    page.setCropBox(box.x + cropLeft, box.y + cropBottom, newWidth, newHeight);
    croppedPageCount++;
  }

  if (croppedPageCount === 0) {
    throw new Error('No matching pages were selected for cropping.');
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pages.length,
    croppedPageCount,
  };
}
