import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { openPdfJsDocument } from '@/src/utils/pdfRender';

export const MAX_MARKDOWN_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface ExtractedPdfTextSpan {
  str: string;
  x: number;
  y: number;
  height: number;
  hasEOL?: boolean;
}

export interface PdfPageTextInput {
  pageNumber: number;
  items: ExtractedPdfTextSpan[];
}

export interface PdfToMarkdownOptions {
  includePageSeparators: boolean;
  detectHeadings: boolean;
}

interface TextLineGroup {
  y: number;
  avgHeight: number;
  text: string;
}

function groupSpansIntoLines(items: ExtractedPdfTextSpan[]): TextLineGroup[] {
  const nonEmpty = items
    .map((item) => ({
      ...item,
      str: item.str.replace(/\s+/g, ' '),
    }))
    .filter((item) => item.str.trim().length > 0);

  if (nonEmpty.length === 0) return [];

  // Sort top-to-bottom (higher PDF Y first), then left-to-right (lower X first)
  const sorted = [...nonEmpty].sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > 3.5) return dy;
    return a.x - b.x;
  });

  const lines: TextLineGroup[] = [];
  let currentSpans: ExtractedPdfTextSpan[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const span = sorted[i];
    const anchor = currentSpans[0];
    const tolerance = Math.max(3.5, Math.min(8, anchor.height * 0.45));
    if (Math.abs(span.y - anchor.y) <= tolerance) {
      currentSpans.push(span);
    } else {
      currentSpans.sort((a, b) => a.x - b.x);
      const joined = currentSpans
        .map((s) => s.str.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+([,.;:!?])/g, '$1');
      const avgHeight =
        currentSpans.reduce((acc, s) => acc + (s.height || 11), 0) / currentSpans.length;
      if (joined) {
        lines.push({ y: anchor.y, avgHeight, text: joined });
      }
      currentSpans = [span];
    }
  }

  if (currentSpans.length > 0) {
    currentSpans.sort((a, b) => a.x - b.x);
    const joined = currentSpans
      .map((s) => s.str.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+([,.;:!?])/g, '$1');
    const avgHeight =
      currentSpans.reduce((acc, s) => acc + (s.height || 11), 0) / currentSpans.length;
    if (joined) {
      lines.push({ y: currentSpans[0].y, avgHeight, text: joined });
    }
  }

  return lines;
}

/**
 * Pure Markdown converter turning extracted PDF text spans into structured headings,
 * bullet lists, paragraphs, and optional page dividers.
 */
export function convertPdfPagesTextToMarkdown(
  pages: PdfPageTextInput[],
  options: PdfToMarkdownOptions,
): { markdown: string; wordCount: number; nonEmptyPages: number } {
  const weightedHeights: Array<{ h: number; weight: number }> = [];
  const groupedPages = pages.map((p) => {
    const lines = groupSpansIntoLines(p.items);
    for (const line of lines) {
      if (line.avgHeight > 0) {
        weightedHeights.push({ h: line.avgHeight, weight: Math.max(1, line.text.length) });
      }
    }
    return { pageNumber: p.pageNumber, lines };
  });

  // Compute character-weighted median body font height so headings stay above baseline
  weightedHeights.sort((a, b) => a.h - b.h);
  const totalWeight = weightedHeights.reduce((sum, item) => sum + item.weight, 0);
  let medianHeight = 11;
  if (weightedHeights.length > 0) {
    let acc = 0;
    for (const item of weightedHeights) {
      acc += item.weight;
      if (acc >= totalWeight * 0.45) {
        medianHeight = item.h;
        break;
      }
    }
  }

  const chunks: string[] = [];
  let nonEmptyPages = 0;

  for (const page of groupedPages) {
    if (page.lines.length === 0) continue;
    nonEmptyPages++;

    if (options.includePageSeparators) {
      if (chunks.length > 0) chunks.push('---');
      chunks.push(`<!-- Page ${page.pageNumber} -->`);
    }

    let paragraphBuffer: string[] = [];
    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        chunks.push(paragraphBuffer.join(' '));
        paragraphBuffer = [];
      }
    };

    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      const prev = i > 0 ? page.lines[i - 1] : null;
      const yGap = prev ? prev.y - line.y : 0;
      const lineText = line.text.trim();

      if (options.detectHeadings && lineText.length <= 120 && line.avgHeight >= medianHeight * 1.45) {
        flushParagraph();
        chunks.push(`# ${lineText}`);
        continue;
      }
      if (options.detectHeadings && lineText.length <= 120 && line.avgHeight >= medianHeight * 1.2) {
        flushParagraph();
        chunks.push(`## ${lineText}`);
        continue;
      }

      const bulletMatch = lineText.match(/^(?:[•◦▪‣]|[-*])\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        chunks.push(`- ${bulletMatch[1].trim()}`);
        continue;
      }

      const numberedMatch = lineText.match(/^(\d{1,3})[.)]\s+(.+)$/);
      if (numberedMatch) {
        flushParagraph();
        chunks.push(`${numberedMatch[1]}. ${numberedMatch[2].trim()}`);
        continue;
      }

      if (prev && yGap > line.avgHeight * 1.75) {
        flushParagraph();
      }
      paragraphBuffer.push(lineText);
    }

    flushParagraph();
  }

  const markdown = chunks.join('\n\n').trim();
  const wordCount = markdown ? markdown.split(/\s+/).filter(Boolean).length : 0;

  return { markdown, wordCount, nonEmptyPages };
}

export async function extractPdfToMarkdown(
  sourceBytes: Uint8Array,
  options: PdfToMarkdownOptions,
  onProgress?: (message: string) => void,
): Promise<{
  markdown: string;
  pageCount: number;
  nonEmptyPages: number;
  wordCount: number;
}> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  onProgress?.('Extracting selectable text from PDF pages...');
  const handle = await openPdfJsDocument(sourceBytes);
  try {
    const pageCount = handle.doc.numPages;
    const pages: PdfPageTextInput[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      onProgress?.(`Reading page ${pageNumber} of ${pageCount}...`);
      const page = await handle.doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const spans: ExtractedPdfTextSpan[] = [];

      for (const rawItem of textContent.items) {
        if (!('str' in rawItem) || !rawItem.str) continue;
        const transform = Array.isArray(rawItem.transform) ? rawItem.transform : [1, 0, 0, 1, 0, 0];
        const height =
          typeof rawItem.height === 'number' && rawItem.height > 0
            ? rawItem.height
            : Math.hypot(transform[2] || 0, transform[3] || 11);
        spans.push({
          str: rawItem.str,
          x: transform[4] ?? 0,
          y: transform[5] ?? 0,
          height,
          hasEOL: Boolean(rawItem.hasEOL),
        });
      }

      pages.push({ pageNumber, items: spans });
    }

    const result = convertPdfPagesTextToMarkdown(pages, options);
    return {
      markdown: result.markdown,
      pageCount,
      nonEmptyPages: result.nonEmptyPages,
      wordCount: result.wordCount,
    };
  } finally {
    await handle.dispose();
  }
}
