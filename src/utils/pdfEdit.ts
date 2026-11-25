import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { hexToRgbUnit } from '@/src/utils/pdfWatermark';

export const MAX_EDIT_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type PdfOverlayAnnotation =
  | {
      id: string;
      type: 'text';
      pageNumber: number;
      xPercent: number;
      yPercent: number;
      text: string;
      fontSize: number;
      colorHex: string;
    }
  | {
      id: string;
      type: 'highlight';
      pageNumber: number;
      xPercent: number;
      yPercent: number;
      widthPercent: number;
      heightPercent: number;
      colorHex: string;
      opacity: number;
    }
  | {
      id: string;
      type: 'rect';
      pageNumber: number;
      xPercent: number;
      yPercent: number;
      widthPercent: number;
      heightPercent: number;
      fillColorHex: string;
      borderColorHex: string;
      opacity: number;
    };

export async function applyPdfAnnotations(
  sourceBytes: Uint8Array,
  annotations: PdfOverlayAnnotation[],
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; appliedCount: number }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }
  if (annotations.length === 0) {
    throw new Error('Add at least one text note, highlight, or shape annotation before saving.');
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before editing.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let appliedCount = 0;

  onProgress?.(`Applying ${annotations.length} annotation(s)...`);

  for (const item of annotations) {
    if (item.pageNumber < 1 || item.pageNumber > pages.length) {
      throw new Error(`Annotation page ${item.pageNumber} is out of bounds.`);
    }
    const page = pages[item.pageNumber - 1];
    const { width, height } = page.getSize();

    if (item.type === 'text') {
      const cleanText = item.text.trim();
      if (!cleanText) continue;
      const { r, g, b } = hexToRgbUnit(item.colorHex);
      const fontSize = Math.max(8, Math.min(72, item.fontSize));
      const x = Math.max(4, Math.min(width - 20, (item.xPercent / 100) * width));
      const y = Math.max(
        4,
        Math.min(height - fontSize - 4, height - (item.yPercent / 100) * height - fontSize),
      );
      page.drawText(cleanText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(r, g, b),
      });
      appliedCount++;
    } else if (item.type === 'highlight') {
      const { r, g, b } = hexToRgbUnit(item.colorHex);
      const boxW = Math.max(8, (item.widthPercent / 100) * width);
      const boxH = Math.max(6, (item.heightPercent / 100) * height);
      const x = Math.max(0, Math.min(width - boxW, (item.xPercent / 100) * width));
      const y = Math.max(0, Math.min(height - boxH, height - (item.yPercent / 100) * height - boxH));
      page.drawRectangle({
        x,
        y,
        width: boxW,
        height: boxH,
        color: rgb(r, g, b),
        opacity: Math.max(0.1, Math.min(0.85, item.opacity)),
      });
      appliedCount++;
    } else {
      const fill = hexToRgbUnit(item.fillColorHex);
      const border = hexToRgbUnit(item.borderColorHex);
      const boxW = Math.max(8, (item.widthPercent / 100) * width);
      const boxH = Math.max(6, (item.heightPercent / 100) * height);
      const x = Math.max(0, Math.min(width - boxW, (item.xPercent / 100) * width));
      const y = Math.max(0, Math.min(height - boxH, height - (item.yPercent / 100) * height - boxH));
      page.drawRectangle({
        x,
        y,
        width: boxW,
        height: boxH,
        color: rgb(fill.r, fill.g, fill.b),
        opacity: Math.max(0.1, Math.min(1, item.opacity)),
        borderColor: rgb(border.r, border.g, border.b),
        borderWidth: 1.5,
      });
      appliedCount++;
    }
  }

  if (appliedCount === 0) {
    throw new Error('No non-empty annotations were available to save.');
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pages.length,
    appliedCount,
  };
}
