export const MAX_MERGE_FILES = 25;
export const MAX_MERGE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_MERGE_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB total queue

export interface MergePdfInputItem {
  name: string;
  bytes: Uint8Array;
}

export interface MergePdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

export function isPdfFileCandidate(file: { name: string; type?: string }): boolean {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false;
  const headerSlice = bytes.subarray(0, Math.min(1024, bytes.byteLength));
  let headerText = '';
  for (let i = 0; i < headerSlice.length; i++) {
    headerText += String.fromCharCode(headerSlice[i]);
  }
  return headerText.includes('%PDF-');
}

function formatPdfLoadError(err: unknown, fileName: string): Error {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('encrypted') || lower.includes('password')) {
    return new Error(
      `"${fileName}" is password-protected or encrypted. Unlock the PDF before merging.`,
    );
  }

  return new Error(
    `"${fileName}" could not be read as a valid PDF file. Please verify it is not corrupted.`,
  );
}

export async function inspectPdfBytes(bytes: Uint8Array, fileName: string): Promise<number> {
  if (bytes.byteLength === 0) {
    throw new Error(`"${fileName}" is empty (0 bytes).`);
  }
  if (!hasPdfSignature(bytes)) {
    throw new Error(`"${fileName}" does not appear to have a valid PDF file header.`);
  }

  const { PDFDocument } = await import('pdf-lib');

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    if (pageCount < 1) {
      throw new Error(`"${fileName}" contains 0 pages.`);
    }
    return pageCount;
  } catch (err) {
    if (err instanceof Error && err.message.includes('contains 0 pages')) {
      throw err;
    }
    throw formatPdfLoadError(err, fileName);
  }
}

export async function mergePdfBuffers(
  items: MergePdfInputItem[],
  onProgress?: (current: number, total: number, fileName: string) => void,
): Promise<MergePdfResult> {
  if (items.length < 2) {
    throw new Error('Please add at least 2 PDF files to merge.');
  }

  const { PDFDocument } = await import('pdf-lib');
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length, item.name);

    if (item.bytes.byteLength === 0 || !hasPdfSignature(item.bytes)) {
      throw new Error(`"${item.name}" is not a valid PDF document.`);
    }

    let sourcePdf: Awaited<ReturnType<typeof PDFDocument.load>>;
    try {
      sourcePdf = await PDFDocument.load(item.bytes, { ignoreEncryption: false });
    } catch (err) {
      throw formatPdfLoadError(err, item.name);
    }

    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const mergedBytes = await mergedPdf.save();
  return {
    bytes: mergedBytes,
    pageCount: mergedPdf.getPageCount(),
  };
}

export function sanitizePdfOutputFilename(rawName: string): string {
  const cleaned = rawName
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${cleaned || 'toolmitra-merged'}.pdf`;
}
