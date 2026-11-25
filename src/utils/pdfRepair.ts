export const MAX_REPAIR_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface RepairPdfResult {
  bytes: Uint8Array;
  recoveredPages: number;
  skippedPages: number;
  trimmedPrefixBytes: number;
  notes: string[];
}

function findPdfHeaderOffset(bytes: Uint8Array): number {
  const limit = Math.min(bytes.byteLength, 4096);
  let text = '';
  for (let i = 0; i < limit; i++) {
    text += String.fromCharCode(bytes[i]);
  }
  return text.indexOf('%PDF-');
}

export async function repairPdfBytes(
  sourceBytes: Uint8Array,
  onProgress?: (message: string) => void,
): Promise<RepairPdfResult> {
  if (sourceBytes.byteLength === 0) {
    throw new Error('The selected file is empty (0 bytes) and cannot be repaired.');
  }

  const headerOffset = findPdfHeaderOffset(sourceBytes);
  if (headerOffset === -1) {
    throw new Error(
      'No %PDF- header found in the first 4 KB. This file does not appear to be a recoverable PDF.',
    );
  }

  const trimmedBytes = headerOffset > 0 ? sourceBytes.subarray(headerOffset) : sourceBytes;
  const notes: string[] = [];
  if (headerOffset > 0) {
    notes.push(`Removed ${headerOffset} leading non-PDF garbage bytes before %PDF- header.`);
  }

  onProgress?.('Loading PDF parser...');
  const { PDFDocument } = await import('pdf-lib');

  let sourceDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    sourceDoc = await PDFDocument.load(trimmedBytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error(
        'This PDF is encrypted or password-protected. Unlock it before running structural repair.',
      );
    }
    throw new Error(
      'The PDF catalog or cross-reference structure is too severely damaged to recover in the browser.',
    );
  }

  const pageIndices = sourceDoc.getPageIndices();
  if (pageIndices.length === 0) {
    throw new Error('No pages were found inside the PDF structure.');
  }

  const cleanDoc = await PDFDocument.create();
  let recoveredPages = 0;
  let skippedPages = 0;

  for (let i = 0; i < pageIndices.length; i++) {
    onProgress?.(`Recovering page ${i + 1} of ${pageIndices.length}...`);
    try {
      const [copied] = await cleanDoc.copyPages(sourceDoc, [pageIndices[i]]);
      cleanDoc.addPage(copied);
      recoveredPages++;
    } catch {
      skippedPages++;
    }
  }

  if (recoveredPages === 0) {
    throw new Error('No readable pages could be recovered from this PDF.');
  }

  notes.push('Rebuilt document cross-reference table and compressed object streams cleanly.');
  if (skippedPages > 0) {
    notes.push(`Skipped ${skippedPages} corrupted page(s) while rescuing ${recoveredPages} readable page(s).`);
  }

  const bytes = await cleanDoc.save({ useObjectStreams: true });
  return {
    bytes,
    recoveredPages,
    skippedPages,
    trimmedPrefixBytes: headerOffset,
    notes,
  };
}
