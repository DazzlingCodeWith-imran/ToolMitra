import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { hexToRgbUnit } from '@/src/utils/pdfWatermark';

export const MAX_PAGE_NUMBERS_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left';

export type PageNumberFormat = 'n' | 'page-n' | 'n-of-total' | 'page-n-of-total';

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: PageNumberFormat;
  startPage: number; // 1-based physical PDF page to begin numbering
  startNumber: number; // Number printed on startPage
  fontSize: number;
  marginPt: number;
  colorHex: string;
}

export function formatPageNumberLabel(
  format: PageNumberFormat,
  displayNumber: number,
  totalDisplayCount: number,
): string {
  switch (format) {
    case 'n':
      return String(displayNumber);
    case 'page-n':
      return `Page ${displayNumber}`;
    case 'n-of-total':
      return `${displayNumber} / ${totalDisplayCount}`;
    case 'page-n-of-total':
      return `Page ${displayNumber} of ${totalDisplayCount}`;
  }
}

export async function addPageNumbersToPdf(
  sourceBytes: Uint8Array,
  options: PageNumberOptions,
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; numberedPages: number }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before adding page numbers.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  if (options.startPage < 1 || options.startPage > totalPages) {
    throw new Error(`Start page must be between 1 and ${totalPages}.`);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { r, g, b } = hexToRgbUnit(options.colorHex);
  const color = rgb(r, g, b);
  const fontSize = Math.max(8, Math.min(28, options.fontSize));
  const margin = Math.max(12, Math.min(80, options.marginPt));

  const numberedCount = totalPages - options.startPage + 1;
  const totalDisplayNumber = options.startNumber + numberedCount - 1;

  onProgress?.(`Numbering ${numberedCount} ${numberedCount === 1 ? 'page' : 'pages'}...`);

  for (let i = options.startPage - 1; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const displayNum = options.startNumber + (i - (options.startPage - 1));
    const label = formatPageNumberLabel(options.format, displayNum, totalDisplayNumber);
    const labelWidth = font.widthOfTextAtSize(label, fontSize);

    let x = margin;
    if (options.position.endsWith('center')) {
      x = Math.max(margin, (width - labelWidth) / 2);
    } else if (options.position.endsWith('right')) {
      x = Math.max(margin, width - labelWidth - margin);
    }

    const y = options.position.startsWith('top')
      ? Math.max(margin, height - margin - fontSize)
      : margin;

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color,
    });
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: totalPages,
    numberedPages: numberedCount,
  };
}
