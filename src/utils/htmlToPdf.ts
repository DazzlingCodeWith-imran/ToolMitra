export type HtmlPageSize = 'a4' | 'letter';
export type HtmlPageOrientation = 'portrait' | 'landscape';

export interface HtmlToPdfOptions {
  pageSize: HtmlPageSize;
  orientation: HtmlPageOrientation;
  marginPt: number;
  baseFontSize: number;
  title?: string;
}

export type HtmlBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'list-item'; marker: string; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'hr' };

export const MAX_HTML_INPUT_CHARS = 250_000;

/**
 * Strips dangerous active HTML constructs (scripts, event handlers, javascript: URLs, iframes)
 * before previewing or converting HTML to PDF.
 */
export function sanitizeHtmlForPrint(rawHtml: string): string {
  return rawHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"');
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&bull;/gi, '•')
    .replace(/&copy;/gi, '©');
}

function stripTagsClean(htmlFragment: string): string {
  return decodeBasicEntities(
    htmlFragment
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim(),
  );
}

/**
 * Extracts readable document blocks (headings, paragraphs, lists, quotes, code blocks, tables)
 * from sanitized HTML without executing scripts or relying on headless Chrome.
 */
export function extractStructuredBlocksFromHtml(rawHtml: string): HtmlBlock[] {
  const sanitized = sanitizeHtmlForPrint(rawHtml)
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '');

  const blocks: HtmlBlock[] = [];
  const tokenRegex =
    /<(h[1-6]|p|blockquote|pre|ul|ol|table|hr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(sanitized)) !== null) {
    // Capture stray plain text between top-level tags
    const gap = stripTagsClean(sanitized.slice(lastIndex, match.index));
    if (gap) {
      blocks.push({ kind: 'paragraph', text: gap });
    }
    lastIndex = tokenRegex.lastIndex;

    const tag = (match[1] || 'hr').toLowerCase();
    const inner = match[2] || '';

    if (tag === 'hr') {
      blocks.push({ kind: 'hr' });
    } else if (tag.startsWith('h')) {
      const level = Math.min(4, Math.max(1, Number(tag.slice(1)) || 1)) as 1 | 2 | 3 | 4;
      const text = stripTagsClean(inner);
      if (text) blocks.push({ kind: 'heading', level, text });
    } else if (tag === 'p') {
      const text = stripTagsClean(inner);
      if (text) blocks.push({ kind: 'paragraph', text });
    } else if (tag === 'blockquote') {
      const text = stripTagsClean(inner);
      if (text) blocks.push({ kind: 'quote', text });
    } else if (tag === 'pre') {
      const code = decodeBasicEntities(inner.replace(/<[^>]+>/g, '')).trim();
      if (code) blocks.push({ kind: 'code', text: code });
    } else if (tag === 'ul' || tag === 'ol') {
      const liMatches = Array.from(inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi));
      liMatches.forEach((li, idx) => {
        const text = stripTagsClean(li[1]);
        if (text) {
          blocks.push({
            kind: 'list-item',
            marker: tag === 'ol' ? `${idx + 1}.` : '•',
            text,
          });
        }
      });
    } else if (tag === 'table') {
      const rows: string[][] = [];
      const rowMatches = Array.from(inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
      for (const rowMatch of rowMatches) {
        const cellMatches = Array.from(
          rowMatch[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi),
        );
        const cells = cellMatches.map((c) => stripTagsClean(c[2]));
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) {
        blocks.push({ kind: 'table', rows });
      }
    }
  }

  const trailing = stripTagsClean(sanitized.slice(lastIndex));
  if (trailing) {
    blocks.push({ kind: 'paragraph', text: trailing });
  }

  return blocks;
}

function toWinAnsiSafe(text: string): string {
  // Replace unsupported Unicode characters gracefully for Standard Helvetica/Courier fonts
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u20B9/g, 'INR ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ');
}

function wrapTextLines(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
): string[] {
  const safe = toWinAnsiSafe(text);
  const paragraphs = safe.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function convertHtmlToPdfBytes(
  rawHtml: string,
  options: HtmlToPdfOptions,
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; blockCount: number }> {
  const trimmed = rawHtml.trim();
  if (!trimmed) {
    throw new Error('Enter or paste HTML content before converting to PDF.');
  }
  if (trimmed.length > MAX_HTML_INPUT_CHARS) {
    throw new Error('HTML input exceeds the 250,000-character browser limit.');
  }

  const blocks = extractStructuredBlocksFromHtml(trimmed);
  if (blocks.length === 0) {
    throw new Error('No visible text or structural HTML elements were found to render.');
  }

  onProgress?.('Building structured PDF document...');
  const { PDFDocument, PageSizes, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  if (options.title?.trim()) {
    pdfDoc.setTitle(toWinAnsiSafe(options.title.trim()));
  }

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const baseSize = options.pageSize === 'letter' ? PageSizes.Letter : PageSizes.A4;
  const pageWidth = options.orientation === 'landscape' ? baseSize[1] : baseSize[0];
  const pageHeight = options.orientation === 'landscape' ? baseSize[0] : baseSize[1];
  const rawMargin = Number.isFinite(options.marginPt) ? options.marginPt : 36;
  const rawFont = Number.isFinite(options.baseFontSize) ? options.baseFontSize : 11;
  const margin = Math.max(24, Math.min(72, rawMargin));
  const contentWidth = pageWidth - margin * 2;
  const baseFont = Math.max(9, Math.min(16, rawFont));

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  };

  for (const block of blocks) {
    if (block.kind === 'hr') {
      ensureSpace(18);
      cursorY -= 6;
      page.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: pageWidth - margin, y: cursorY },
        thickness: 0.75,
        color: rgb(0.82, 0.85, 0.89),
      });
      cursorY -= 12;
      continue;
    }

    if (block.kind === 'heading') {
      const sizeMap = {
        1: baseFont + 11,
        2: baseFont + 7,
        3: baseFont + 4,
        4: baseFont + 2,
      };
      const fontSize = sizeMap[block.level];
      const lineHeight = fontSize * 1.3;
      const lines = wrapTextLines(block.text, contentWidth, fontBold, fontSize);
      ensureSpace(lines.length * lineHeight + 12);
      cursorY -= block.level === 1 ? 4 : 8;
      for (const line of lines) {
        page.drawText(line, {
          x: margin,
          y: cursorY - fontSize,
          size: fontSize,
          font: fontBold,
          color: rgb(0.06, 0.09, 0.16),
        });
        cursorY -= lineHeight;
      }
      cursorY -= 6;
      continue;
    }

    if (block.kind === 'paragraph') {
      const lineHeight = baseFont * 1.48;
      const lines = wrapTextLines(block.text, contentWidth, fontRegular, baseFont);
      for (const line of lines) {
        ensureSpace(lineHeight + 2);
        page.drawText(line, {
          x: margin,
          y: cursorY - baseFont,
          size: baseFont,
          font: fontRegular,
          color: rgb(0.15, 0.19, 0.27),
        });
        cursorY -= lineHeight;
      }
      cursorY -= 8;
      continue;
    }

    if (block.kind === 'quote') {
      const lineHeight = baseFont * 1.45;
      const lines = wrapTextLines(block.text, contentWidth - 18, fontItalic, baseFont);
      const blockH = lines.length * lineHeight + 8;
      ensureSpace(blockH + 8);
      page.drawRectangle({
        x: margin,
        y: cursorY - blockH,
        width: 3,
        height: blockH,
        color: rgb(0.15, 0.39, 0.92),
      });
      cursorY -= 4;
      for (const line of lines) {
        page.drawText(line, {
          x: margin + 12,
          y: cursorY - baseFont,
          size: baseFont,
          font: fontItalic,
          color: rgb(0.28, 0.33, 0.41),
        });
        cursorY -= lineHeight;
      }
      cursorY -= 10;
      continue;
    }

    if (block.kind === 'code') {
      const codeFont = Math.max(8, baseFont - 1.5);
      const lineHeight = codeFont * 1.4;
      const lines = wrapTextLines(block.text, contentWidth - 20, fontMono, codeFont);
      const boxH = lines.length * lineHeight + 14;
      ensureSpace(boxH + 10);
      page.drawRectangle({
        x: margin,
        y: cursorY - boxH,
        width: contentWidth,
        height: boxH,
        color: rgb(0.95, 0.96, 0.98),
        borderColor: rgb(0.86, 0.89, 0.93),
        borderWidth: 0.75,
      });
      cursorY -= 7;
      for (const line of lines) {
        page.drawText(line, {
          x: margin + 10,
          y: cursorY - codeFont,
          size: codeFont,
          font: fontMono,
          color: rgb(0.09, 0.13, 0.2),
        });
        cursorY -= lineHeight;
      }
      cursorY -= 12;
      continue;
    }

    if (block.kind === 'list-item') {
      const lineHeight = baseFont * 1.45;
      const lines = wrapTextLines(block.text, contentWidth - 18, fontRegular, baseFont);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(lineHeight + 2);
        if (i === 0) {
          page.drawText(toWinAnsiSafe(block.marker), {
            x: margin + 4,
            y: cursorY - baseFont,
            size: baseFont,
            font: fontBold,
            color: rgb(0.15, 0.39, 0.92),
          });
        }
        page.drawText(lines[i], {
          x: margin + 18,
          y: cursorY - baseFont,
          size: baseFont,
          font: fontRegular,
          color: rgb(0.15, 0.19, 0.27),
        });
        cursorY -= lineHeight;
      }
      cursorY -= 4;
      continue;
    }

    if (block.kind === 'table') {
      const colCount = Math.max(...block.rows.map((r) => r.length), 1);
      const colWidth = contentWidth / colCount;
      const cellFont = Math.max(8, baseFont - 1);
      const cellLineH = cellFont * 1.35;

      for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
        const row = block.rows[rIdx];
        const wrappedCells = row.map((cell) =>
          wrapTextLines(cell, Math.max(24, colWidth - 10), rIdx === 0 ? fontBold : fontRegular, cellFont),
        );
        const maxLines = Math.max(...wrappedCells.map((c) => Math.max(1, c.length)));
        const rowH = maxLines * cellLineH + 10;
        ensureSpace(rowH + 4);

        if (rIdx === 0) {
          page.drawRectangle({
            x: margin,
            y: cursorY - rowH,
            width: contentWidth,
            height: rowH,
            color: rgb(0.94, 0.96, 0.99),
          });
        }

        for (let cIdx = 0; cIdx < colCount; cIdx++) {
          const cellX = margin + cIdx * colWidth;
          page.drawRectangle({
            x: cellX,
            y: cursorY - rowH,
            width: colWidth,
            height: rowH,
            borderColor: rgb(0.84, 0.87, 0.91),
            borderWidth: 0.6,
          });
          const cellLines = wrappedCells[cIdx] ?? [];
          cellLines.forEach((line, lIdx) => {
            page.drawText(line, {
              x: cellX + 5,
              y: cursorY - 6 - cellFont - lIdx * cellLineH,
              size: cellFont,
              font: rIdx === 0 ? fontBold : fontRegular,
              color: rgb(0.11, 0.15, 0.22),
            });
          });
        }
        cursorY -= rowH;
      }
      cursorY -= 10;
    }
  }

  onProgress?.('Saving PDF...');
  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pdfDoc.getPageCount(),
    blockCount: blocks.length,
  };
}
