import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

export const MAX_PDF_TO_JPG_BYTES = 50 * 1024 * 1024; // 50 MB

export interface PdfToJpgPageOutput {
  pageNumber: number;
  filename: string;
  widthPx: number;
  heightPx: number;
  size: number;
  blob: Blob;
  bytes: Uint8Array;
}

export async function convertPdfPagesToJpg(
  sourceBytes: Uint8Array,
  pageNumbers: number[],
  baseFilename: string,
  options: { scale: number; quality: number },
  onProgress?: (current: number, total: number, pageNumber: number) => void,
): Promise<PdfToJpgPageOutput[]> {
  if (pageNumbers.length === 0) {
    throw new Error('Select at least one page to convert to JPG.');
  }

  const cleanBase = sanitizeBasePdfName(baseFilename, 'toolmitra-page');
  const handle = await openPdfJsDocument(sourceBytes);

  try {
    const totalPages = handle.doc.numPages;
    const padLength = String(totalPages).length;
    const outputs: PdfToJpgPageOutput[] = [];

    for (let i = 0; i < pageNumbers.length; i++) {
      const pageNum = pageNumbers[i];
      if (pageNum < 1 || pageNum > totalPages) {
        throw new Error(`Page ${pageNum} is out of bounds (1–${totalPages}).`);
      }

      onProgress?.(i + 1, pageNumbers.length, pageNum);
      const rendered = await renderPdfPageToJpegBlob(
        handle.doc,
        pageNum,
        options.scale,
        options.quality,
      );

      const paddedPage = String(pageNum).padStart(padLength, '0');
      outputs.push({
        pageNumber: pageNum,
        filename: `${cleanBase}-page-${paddedPage}.jpg`,
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        size: rendered.blob.size,
        blob: rendered.blob,
        bytes: rendered.bytes,
      });
    }

    return outputs;
  } finally {
    await handle.dispose();
  }
}

export async function createJpgZipBlob(
  items: Array<{ filename: string; bytes: Uint8Array }>,
): Promise<Blob> {
  if (items.length === 0) {
    throw new Error('No JPG images available to archive.');
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const item of items) {
    zip.file(item.filename, item.bytes);
  }
  return await zip.generateAsync({ type: 'blob' });
}
