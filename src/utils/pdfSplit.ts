import { hasPdfSignature } from '@/src/utils/pdfMerge';

export const MAX_SPLIT_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface ParsedRangesResult {
  valid: boolean;
  groups: number[][];
  flatUniquePages: number[];
  error: string | null;
}

export interface SplitPageGroup {
  label: string;
  pages: number[]; // 1-based page numbers
}

export interface SplitPdfOutputPart {
  filename: string;
  label: string;
  pageCount: number;
  pages: number[];
  bytes: Uint8Array;
}

export function sanitizeBasePdfName(rawName: string, fallback = 'toolmitra-split'): string {
  const cleaned = rawName
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export function parsePageRanges(input: string, totalPages: number): ParsedRangesResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      valid: false,
      groups: [],
      flatUniquePages: [],
      error: 'Enter one or more page numbers or ranges (for example: 1-3, 5, 8-10).',
    };
  }

  if (totalPages < 1) {
    return {
      valid: false,
      groups: [],
      flatUniquePages: [],
      error: 'Document page count is invalid.',
    };
  }

  const tokens = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (tokens.length === 0) {
    return {
      valid: false,
      groups: [],
      flatUniquePages: [],
      error: 'Enter at least one valid page number or range.',
    };
  }

  const groups: number[][] = [];
  const seen = new Set<number>();
  const flatUniquePages: number[] = [];

  for (const token of tokens) {
    const singleMatch = /^(\d+)$/.exec(token);
    if (singleMatch) {
      const pageNum = Number(singleMatch[1]);
      if (pageNum < 1 || pageNum > totalPages) {
        return {
          valid: false,
          groups: [],
          flatUniquePages: [],
          error: `Page ${pageNum} is out of range. This PDF has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }
      groups.push([pageNum]);
      if (!seen.has(pageNum)) {
        seen.add(pageNum);
        flatUniquePages.push(pageNum);
      }
      continue;
    }

    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
        return {
          valid: false,
          groups: [],
          flatUniquePages: [],
          error: `Range "${token}" is out of bounds. Enter pages between 1 and ${totalPages}.`,
        };
      }
      if (start > end) {
        return {
          valid: false,
          groups: [],
          flatUniquePages: [],
          error: `Range "${token}" is reversed. Use ascending numbers such as ${end}-${start}.`,
        };
      }
      const group: number[] = [];
      for (let p = start; p <= end; p++) {
        group.push(p);
        if (!seen.has(p)) {
          seen.add(p);
          flatUniquePages.push(p);
        }
      }
      groups.push(group);
      continue;
    }

    return {
      valid: false,
      groups: [],
      flatUniquePages: [],
      error: `Invalid range "${token}". Use numbers and hyphens separated by commas (e.g., 1-3, 5).`,
    };
  }

  return {
    valid: true,
    groups,
    flatUniquePages,
    error: null,
  };
}

export function buildFixedSizeGroups(totalPages: number, pagesPerFile: number): SplitPageGroup[] {
  if (!Number.isInteger(pagesPerFile) || pagesPerFile < 1) {
    throw new Error('Pages per split file must be at least 1.');
  }
  if (totalPages < 1) {
    throw new Error('PDF must contain at least 1 page.');
  }

  const groups: SplitPageGroup[] = [];
  for (let start = 1; start <= totalPages; start += pagesPerFile) {
    const end = Math.min(totalPages, start + pagesPerFile - 1);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    const label = start === end ? `Page ${start}` : `Pages ${start}-${end}`;
    groups.push({ label, pages });
  }
  return groups;
}

export function formatPageGroupLabel(pages: number[]): string {
  if (pages.length === 0) return 'Empty';
  if (pages.length === 1) return `Page ${pages[0]}`;

  // Summarize contiguous runs cleanly (e.g., "1-3, 5")
  const runs: string[] = [];
  let runStart = pages[0];
  let prev = pages[0];

  for (let i = 1; i < pages.length; i++) {
    const current = pages[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      runs.push(runStart === prev ? String(runStart) : `${runStart}-${prev}`);
      runStart = current;
      prev = current;
    }
  }
  runs.push(runStart === prev ? String(runStart) : `${runStart}-${prev}`);
  return `Pages ${runs.join(', ')}`;
}

export async function splitPdfByGroups(
  sourceBytes: Uint8Array,
  groups: SplitPageGroup[],
  baseFilename: string,
  onProgress?: (current: number, total: number) => void,
): Promise<SplitPdfOutputPart[]> {
  if (groups.length === 0) {
    throw new Error('Select at least one page or range to split.');
  }
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  const cleanBase = sanitizeBasePdfName(baseFilename);
  const { PDFDocument } = await import('pdf-lib');

  let sourceDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before splitting.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const totalPages = sourceDoc.getPageCount();
  const outputs: SplitPdfOutputPart[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    onProgress?.(i + 1, groups.length);

    if (group.pages.length === 0) continue;
    for (const p of group.pages) {
      if (p < 1 || p > totalPages) {
        throw new Error(`Page ${p} is out of bounds (1–${totalPages}).`);
      }
    }

    const outDoc = await PDFDocument.create();
    const zeroBasedIndices = group.pages.map((p) => p - 1);
    const copiedPages = await outDoc.copyPages(sourceDoc, zeroBasedIndices);
    for (const page of copiedPages) {
      outDoc.addPage(page);
    }

    const bytes = await outDoc.save();
    const suffix =
      groups.length === 1
        ? 'extracted'
        : `part-${String(i + 1).padStart(String(groups.length).length, '0')}`;

    outputs.push({
      filename: `${cleanBase}-${suffix}.pdf`,
      label: group.label,
      pageCount: group.pages.length,
      pages: group.pages,
      bytes,
    });
  }

  return outputs;
}

export async function createSplitZipBlob(parts: SplitPdfOutputPart[]): Promise<Blob> {
  if (parts.length === 0) {
    throw new Error('No split PDF files available to archive.');
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const part of parts) {
    zip.file(part.filename, part.bytes);
  }
  return await zip.generateAsync({ type: 'blob' });
}
