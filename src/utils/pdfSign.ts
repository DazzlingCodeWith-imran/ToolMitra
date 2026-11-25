import { hasPdfSignature } from '@/src/utils/pdfMerge';

export const MAX_SIGN_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface SignaturePlacement {
  pageNumbers: number[]; // 1-based
  xPercent: number; // 0..100 from left
  yPercent: number; // 0..100 from top
  widthPercent: number; // 5..65 of page width
  opacity?: number; // 0.2..1
}

export async function placeSignatureOnPdf(
  sourceBytes: Uint8Array,
  signatureImageBytes: Uint8Array,
  signatureMime: 'image/png' | 'image/jpeg',
  placement: SignaturePlacement,
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; signedPages: number }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }
  if (signatureImageBytes.byteLength === 0) {
    throw new Error('Draw, type, or upload a signature first.');
  }
  if (placement.pageNumbers.length === 0) {
    throw new Error('Select at least one page to place the signature.');
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before signing.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const pages = pdfDoc.getPages();
  const embedded =
    signatureMime === 'image/png'
      ? await pdfDoc.embedPng(signatureImageBytes)
      : await pdfDoc.embedJpg(signatureImageBytes);

  const widthRatio = Math.max(0.05, Math.min(0.65, placement.widthPercent / 100));
  const opacity = Math.max(0.2, Math.min(1, placement.opacity ?? 1));
  let signedPages = 0;

  for (const pageNum of placement.pageNumbers) {
    if (pageNum < 1 || pageNum > pages.length) {
      throw new Error(`Page ${pageNum} is out of bounds (1–${pages.length}).`);
    }

    onProgress?.(`Applying signature on page ${pageNum}...`);
    const page = pages[pageNum - 1];
    const { width, height } = page.getSize();

    const drawW = width * widthRatio;
    const drawH = (embedded.height / embedded.width) * drawW;

    const rawX = (placement.xPercent / 100) * width;
    const rawTopY = (placement.yPercent / 100) * height;

    const clampedX = Math.max(4, Math.min(width - drawW - 4, rawX));
    const clampedPdfY = Math.max(4, Math.min(height - drawH - 4, height - rawTopY - drawH));

    page.drawImage(embedded, {
      x: clampedX,
      y: clampedPdfY,
      width: drawW,
      height: drawH,
      opacity,
    });
    signedPages++;
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pages.length,
    signedPages,
  };
}
