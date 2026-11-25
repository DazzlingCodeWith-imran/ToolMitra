import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { normalizeRotationAngle, type RotationAngle } from '@/src/utils/pdfRotate';

export const MAX_ORGANIZE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface OrganizePageSpec {
  sourcePageIndex: number; // 0-based index in original PDF
  rotationDelta: RotationAngle;
}

export interface OrganizePdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

export async function organizePdfPages(
  sourceBytes: Uint8Array,
  specs: OrganizePageSpec[],
  onProgress?: (message: string) => void,
): Promise<OrganizePdfResult> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }
  if (specs.length === 0) {
    throw new Error('Keep at least one page before saving the organized PDF.');
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument, degrees } = await import('pdf-lib');

  let sourceDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before organizing.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const totalSourcePages = sourceDoc.getPageCount();
  for (const spec of specs) {
    if (
      !Number.isInteger(spec.sourcePageIndex) ||
      spec.sourcePageIndex < 0 ||
      spec.sourcePageIndex >= totalSourcePages
    ) {
      throw new Error(`Invalid page reference (${spec.sourcePageIndex + 1}).`);
    }
  }

  onProgress?.(`Assembling ${specs.length} ${specs.length === 1 ? 'page' : 'pages'}...`);
  const outDoc = await PDFDocument.create();
  const indices = specs.map((item) => item.sourcePageIndex);
  const copiedPages = await outDoc.copyPages(sourceDoc, indices);

  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    const delta = normalizeRotationAngle(specs[i].rotationDelta);
    if (delta !== 0) {
      const current = page.getRotation().angle;
      page.setRotation(degrees(normalizeRotationAngle(current + delta)));
    }
    outDoc.addPage(page);
  }

  const bytes = await outDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: outDoc.getPageCount(),
  };
}
