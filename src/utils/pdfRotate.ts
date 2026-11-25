import { hasPdfSignature } from '@/src/utils/pdfMerge';

export const MAX_ROTATE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type RotationAngle = 0 | 90 | 180 | 270;

export function normalizeRotationAngle(angle: number): RotationAngle {
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export interface RotatePdfResult {
  bytes: Uint8Array;
  pageCount: number;
  rotatedPageCount: number;
}

export async function rotatePdfPages(
  sourceBytes: Uint8Array,
  pageOffsets: number[],
  onProgress?: (message: string) => void,
): Promise<RotatePdfResult> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument, degrees } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before rotating.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const pages = pdfDoc.getPages();
  let rotatedPageCount = 0;

  onProgress?.(`Applying rotation across ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}...`);

  for (let i = 0; i < pages.length; i++) {
    const offset = normalizeRotationAngle(pageOffsets[i] ?? 0);
    if (offset !== 0) {
      const currentAngle = pages[i].getRotation().angle;
      const nextAngle = normalizeRotationAngle(currentAngle + offset);
      pages[i].setRotation(degrees(nextAngle));
      rotatedPageCount++;
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pages.length,
    rotatedPageCount,
  };
}
