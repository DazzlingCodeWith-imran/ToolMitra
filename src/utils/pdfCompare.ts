import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { openPdfJsDocument } from '@/src/utils/pdfRender';

export const MAX_COMPARE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface DiffLineEntry {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

export interface PageDiffSummary {
  pageNumber: number;
  lines: DiffLineEntry[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

/**
 * Pure LCS line diff algorithm for comparing extracted PDF page lines cleanly.
 */
export function diffTextLines(linesA: string[], linesB: string[]): {
  entries: DiffLineEntry[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
} {
  const m = linesA.length;
  const n = linesB.length;

  // Guard huge pages against quadratic memory allocation
  if (m * n > 250_000) {
    const setA = new Set(linesA);
    const setB = new Set(linesB);
    const entries: DiffLineEntry[] = [];
    let removedCount = 0;
    let addedCount = 0;
    let unchangedCount = 0;

    for (const line of linesA) {
      if (setB.has(line)) {
        entries.push({ kind: 'same', text: line });
        unchangedCount++;
      } else {
        entries.push({ kind: 'removed', text: line });
        removedCount++;
      }
    }
    for (const line of linesB) {
      if (!setA.has(line)) {
        entries.push({ kind: 'added', text: line });
        addedCount++;
      }
    }
    return { entries, addedCount, removedCount, unchangedCount };
  }

  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (linesA[i] === linesB[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const entries: DiffLineEntry[] = [];
  let i = 0;
  let j = 0;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  while (i < m && j < n) {
    if (linesA[i] === linesB[j]) {
      entries.push({ kind: 'same', text: linesA[i] });
      unchangedCount++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      entries.push({ kind: 'removed', text: linesA[i] });
      removedCount++;
      i++;
    } else {
      entries.push({ kind: 'added', text: linesB[j] });
      addedCount++;
      j++;
    }
  }

  while (i < m) {
    entries.push({ kind: 'removed', text: linesA[i++] });
    removedCount++;
  }
  while (j < n) {
    entries.push({ kind: 'added', text: linesB[j++] });
    addedCount++;
  }

  return { entries, addedCount, removedCount, unchangedCount };
}

/**
 * Pure RGBA pixel-level heatmap computation highlighting changed areas in red.
 */
export function computePixelDiffRgba(
  rgbaA: Uint8ClampedArray,
  rgbaB: Uint8ClampedArray,
  threshold = 28,
): { diffRgba: Uint8ClampedArray; changedPixels: number; totalPixels: number } {
  const len = Math.min(rgbaA.length, rgbaB.length);
  const diffRgba = new Uint8ClampedArray(len);
  let changedPixels = 0;
  const totalPixels = Math.floor(len / 4);

  for (let i = 0; i < len; i += 4) {
    const delta =
      Math.abs(rgbaA[i] - rgbaB[i]) +
      Math.abs(rgbaA[i + 1] - rgbaB[i + 1]) +
      Math.abs(rgbaA[i + 2] - rgbaB[i + 2]);

    if (delta > threshold * 3) {
      changedPixels++;
      diffRgba[i] = 225;
      diffRgba[i + 1] = 29;
      diffRgba[i + 2] = 72;
      diffRgba[i + 3] = 255;
    } else {
      // Soft faded monochrome context for unchanged pixels
      const luma = Math.round(0.3 * rgbaB[i] + 0.59 * rgbaB[i + 1] + 0.11 * rgbaB[i + 2]);
      const faded = Math.min(255, Math.round(luma * 0.35 + 165));
      diffRgba[i] = faded;
      diffRgba[i + 1] = faded;
      diffRgba[i + 2] = faded;
      diffRgba[i + 3] = 255;
    }
  }

  return { diffRgba, changedPixels, totalPixels };
}

export async function extractPdfLinesPerPage(sourceBytes: Uint8Array): Promise<string[][]> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }
  const handle = await openPdfJsDocument(sourceBytes);
  try {
    const pagesLines: string[][] = [];
    for (let pageNumber = 1; pageNumber <= handle.doc.numPages; pageNumber++) {
      const page = await handle.doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let current = '';
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4 && current.trim()) {
          lines.push(current.trim());
          current = item.str;
        } else {
          current += (current && item.str ? ' ' : '') + item.str;
        }
        if (item.hasEOL && current.trim()) {
          lines.push(current.trim());
          current = '';
          lastY = null;
        } else if (y !== null) {
          lastY = y;
        }
      }
      if (current.trim()) {
        lines.push(current.trim());
      }
      pagesLines.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean));
    }
    return pagesLines;
  } finally {
    await handle.dispose();
  }
}

export function formatComparisonReportMarkdown(
  fileAName: string,
  fileBName: string,
  pageDiffs: PageDiffSummary[],
): string {
  const lines: string[] = [
    `# PDF Comparison Report`,
    ``,
    `- **Original (A):** ${fileAName}`,
    `- **Revised (B):** ${fileBName}`,
    `- **Pages Compared:** ${pageDiffs.length}`,
    ``,
  ];

  for (const page of pageDiffs) {
    lines.push(
      `## Page ${page.pageNumber} (+${page.addedCount} added, -${page.removedCount} removed)`,
    );
    if (page.addedCount === 0 && page.removedCount === 0) {
      lines.push(`No text differences detected.`);
    } else {
      for (const entry of page.lines) {
        if (entry.kind === 'added') lines.push(`+ ${entry.text}`);
        else if (entry.kind === 'removed') lines.push(`- ${entry.text}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
