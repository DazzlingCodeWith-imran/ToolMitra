import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { openPdfJsDocument } from '@/src/utils/pdfRender';

export const MAX_OCR_FILE_BYTES = 35 * 1024 * 1024; // 35 MB
export const MAX_OCR_PAGES = 25;

export type OcrLanguageCode = 'eng' | 'hin' | 'spa' | 'fra' | 'deu';

export const OCR_LANGUAGES: Array<{ code: OcrLanguageCode; label: string }> = [
  { code: 'eng', label: 'English (eng)' },
  { code: 'hin', label: 'Hindi (hin)' },
  { code: 'spa', label: 'Spanish (spa)' },
  { code: 'fra', label: 'French (fra)' },
  { code: 'deu', label: 'German (deu)' },
];

export interface OcrLineBox {
  text: string;
  /** Normalized 0..1 coordinates from top-left */
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
}

export interface PageOcrResult {
  pageNumber: number;
  text: string;
  confidence: number;
  lines: OcrLineBox[];
}

function toSafeWinAnsi(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

/**
 * Pure helper embedding invisible selectable OCR text onto matching PDF pages using pdf-lib
 * so scanned PDFs become searchable in standard PDF viewers.
 */
export async function buildSearchableOcrPdf(
  sourceBytes: Uint8Array,
  pageResults: PageOcrResult[],
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; searchablePages: number }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  onProgress?.('Embedding invisible searchable text layer into PDF...');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  let searchablePages = 0;
  for (const res of pageResults) {
    if (res.pageNumber < 1 || res.pageNumber > pages.length) continue;
    const page = pages[res.pageNumber - 1];
    const { width, height } = page.getSize();

    if (res.lines.length > 0) {
      searchablePages++;
      for (const line of res.lines) {
        const clean = toSafeWinAnsi(line.text).trim();
        if (!clean) continue;
        const estFontSize = Math.max(6, Math.min(28, line.heightNorm * height * 0.8));
        const x = Math.max(4, Math.min(width - 20, line.xNorm * width));
        const y = Math.max(
          4,
          Math.min(height - estFontSize, height - (line.yNorm + line.heightNorm) * height),
        );
        page.drawText(clean, {
          x,
          y,
          size: estFontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      }
    } else if (res.text.trim()) {
      searchablePages++;
      const fallbackLines = toSafeWinAnsi(res.text)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 60);
      fallbackLines.forEach((line, idx) => {
        page.drawText(line, {
          x: 24,
          y: Math.max(12, height - 30 - idx * 12),
          size: 9,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      });
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pages.length,
    searchablePages,
  };
}

/**
 * Browser-only runner: renders target PDF pages to canvas via PDF.js and runs Tesseract.js OCR.
 */
export async function runBrowserOcrOnPdf(
  sourceBytes: Uint8Array,
  options: {
    pageNumbers: number[];
    language: OcrLanguageCode;
  },
  onProgress?: (message: string) => void,
): Promise<{
  pageResults: PageOcrResult[];
  combinedText: string;
  searchablePdfBytes: Uint8Array;
}> {
  if (typeof document === 'undefined') {
    throw new Error('OCR rasterization requires a browser canvas environment.');
  }
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  onProgress?.(`Loading Tesseract OCR engine (${options.language})...`);
  const { createWorker } = await import('tesseract.js');
  const handle = await openPdfJsDocument(sourceBytes);
  const worker = await createWorker(options.language, 1, {
    logger: (info) => {
      if (info.status === 'recognizing text' && typeof info.progress === 'number') {
        onProgress?.(`Recognizing text (${Math.round(info.progress * 100)}%)...`);
      }
    },
  });

  const pageResults: PageOcrResult[] = [];

  try {
    for (let i = 0; i < options.pageNumbers.length; i++) {
      const pageNum = options.pageNumbers[i];
      onProgress?.(`Rendering & scanning page ${pageNum} (${i + 1}/${options.pageNumbers.length})...`);

      const page = await handle.doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Browser Canvas 2D context unavailable.');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, viewport }).promise;
      const result = await worker.recognize(canvas, {}, { blocks: true });

      const lines: OcrLineBox[] = [];
      const blocks = result.data.blocks ?? [];
      for (const block of blocks) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            const clean = (line.text || '').trim();
            if (!clean) continue;
            const bbox = line.bbox;
            lines.push({
              text: clean,
              xNorm: bbox.x0 / canvas.width,
              yNorm: bbox.y0 / canvas.height,
              widthNorm: Math.max(0.01, (bbox.x1 - bbox.x0) / canvas.width),
              heightNorm: Math.max(0.01, (bbox.y1 - bbox.y0) / canvas.height),
            });
          }
        }
      }

      pageResults.push({
        pageNumber: pageNum,
        text: (result.data.text || '').trim(),
        confidence: Math.round(result.data.confidence || 0),
        lines,
      });

      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
    await handle.dispose();
  }

  const combinedText = pageResults
    .map((r) => `--- Page ${r.pageNumber} (${r.confidence}% confidence) ---\n${r.text}`)
    .join('\n\n')
    .trim();

  const built = await buildSearchableOcrPdf(sourceBytes, pageResults, onProgress);
  return {
    pageResults,
    combinedText,
    searchablePdfBytes: built.bytes,
  };
}
