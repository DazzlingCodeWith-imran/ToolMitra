import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { openPdfJsDocument } from '@/src/utils/pdfRender';

export const MAX_REDACT_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface RedactionBox {
  id: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  label?: string;
}

export interface RedactedPageBitmap {
  pageNumber: number;
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
}

/**
 * Finds bounding percentage boxes for text matches across PDF pages using PDF.js text geometry.
 */
export async function findTextRedactionBoxesInPdf(
  sourceBytes: Uint8Array,
  searchTerm: string,
  caseSensitive = false,
): Promise<RedactionBox[]> {
  const cleanQuery = searchTerm.trim();
  if (!cleanQuery) return [];
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  const handle = await openPdfJsDocument(sourceBytes);
  const matches: RedactionBox[] = [];
  const needle = caseSensitive ? cleanQuery : cleanQuery.toLowerCase();

  try {
    for (let pageNumber = 1; pageNumber <= handle.doc.numPages; pageNumber++) {
      const page = await handle.doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      for (let i = 0; i < textContent.items.length; i++) {
        const item = textContent.items[i];
        if (!('str' in item) || !item.str) continue;

        const haystack = caseSensitive ? item.str : item.str.toLowerCase();
        const hitIdx = haystack.indexOf(needle);
        if (hitIdx === -1) continue;

        const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
        const rawX = transform[4] ?? 0;
        const rawY = transform[5] ?? 0;
        const itemWidth = Math.max(8, typeof item.width === 'number' ? item.width : cleanQuery.length * 6);
        const itemHeight = Math.max(
          8,
          typeof item.height === 'number' && item.height > 0
            ? item.height
            : Math.hypot(transform[2] || 0, transform[3] || 11),
        );

        // Compute sub-span slice horizontally if only part of the text run matched
        const totalChars = Math.max(1, item.str.length);
        const startRatio = hitIdx / totalChars;
        const spanRatio = Math.min(1, (cleanQuery.length + 0.4) / totalChars);
        const boxX = rawX + itemWidth * startRatio;
        const boxW = Math.max(10, itemWidth * spanRatio + 4);
        const boxH = itemHeight * 1.28;
        const boxTopY = viewport.height - (rawY + itemHeight * 1.02);

        const xPercent = Math.max(0, Math.min(98, (boxX / viewport.width) * 100));
        const yPercent = Math.max(0, Math.min(98, (boxTopY / viewport.height) * 100));
        const widthPercent = Math.max(1.5, Math.min(100 - xPercent, (boxW / viewport.width) * 100));
        const heightPercent = Math.max(1.5, Math.min(100 - yPercent, (boxH / viewport.height) * 100));

        matches.push({
          id: `match-${pageNumber}-${i}-${hitIdx}`,
          pageNumber,
          xPercent: Number(xPercent.toFixed(2)),
          yPercent: Number(yPercent.toFixed(2)),
          widthPercent: Number(widthPercent.toFixed(2)),
          heightPercent: Number(heightPercent.toFixed(2)),
          label: cleanQuery,
        });
      }
    }
  } finally {
    await handle.dispose();
  }

  return matches;
}

/**
 * Permanently replaces redacted pages with flattened raster bitmaps containing opaque black
 * rectangles while copying un-redacted pages losslessly. Because the PDF page vector/text
 * stream on redacted pages is replaced by a flat image, redacted text cannot be copied or selected.
 */
export async function rebuildPdfWithRedactedBitmaps(
  sourceBytes: Uint8Array,
  redactedPages: RedactedPageBitmap[],
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; redactedPageCount: number }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }
  if (redactedPages.length === 0) {
    throw new Error('Mark at least one area or keyword to redact before saving.');
  }

  onProgress?.('Rebuilding PDF with permanently flattened redactions...');
  const { PDFDocument } = await import('pdf-lib');

  let srcDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before redacting.');
    }
    throw new Error('Could not read PDF structure.');
  }

  const outDoc = await PDFDocument.create();
  const totalPages = srcDoc.getPageCount();
  const bitmapMap = new Map<number, RedactedPageBitmap>();
  for (const item of redactedPages) {
    bitmapMap.set(item.pageNumber, item);
  }

  for (let i = 0; i < totalPages; i++) {
    const pageNumber = i + 1;
    const replacement = bitmapMap.get(pageNumber);

    if (!replacement) {
      const [copied] = await outDoc.copyPages(srcDoc, [i]);
      outDoc.addPage(copied);
      continue;
    }

    onProgress?.(`Flattening redacted page ${pageNumber} of ${totalPages}...`);
    const origPage = srcDoc.getPage(i);
    const { width, height } = origPage.getSize();
    const newPage = outDoc.addPage([width, height]);
    const embedded =
      replacement.mimeType === 'image/png'
        ? await outDoc.embedPng(replacement.bytes)
        : await outDoc.embedJpg(replacement.bytes);
    newPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  // Strip XMP/title/author metadata on redacted output for privacy hygiene
  outDoc.setTitle('');
  outDoc.setAuthor('');
  outDoc.setSubject('');
  outDoc.setKeywords([]);

  const bytes = await outDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: outDoc.getPageCount(),
    redactedPageCount: bitmapMap.size,
  };
}
