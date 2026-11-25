import { compressPdfStructure } from '@/src/utils/pdfCompress';
import { mergePdfBuffers } from '@/src/utils/pdfMerge';
import {
  addPageNumbersToPdf,
  type PageNumberFormat,
  type PageNumberPosition,
} from '@/src/utils/pdfPageNumbers';
import { rotatePdfPages } from '@/src/utils/pdfRotate';
import { applyPdfWatermark, type WatermarkPlacement } from '@/src/utils/pdfWatermark';

export interface PdfWorkflowOptions {
  rotateAllDeg: 0 | 90 | 180 | 270;
  enableWatermark: boolean;
  watermarkText: string;
  watermarkPlacement: WatermarkPlacement;
  watermarkOpacity: number;
  enablePageNumbers: boolean;
  pageNumberPosition: PageNumberPosition;
  pageNumberFormat: PageNumberFormat;
  enableCompress: boolean;
  stripMetadata: boolean;
}

export interface PdfWorkflowStepLog {
  step: string;
  detail: string;
}

export async function runPdfWorkflowPipeline(
  inputFiles: Array<{ name: string; bytes: Uint8Array }>,
  options: PdfWorkflowOptions,
  onProgress?: (message: string) => void,
): Promise<{
  bytes: Uint8Array;
  pageCount: number;
  stepLogs: PdfWorkflowStepLog[];
}> {
  if (inputFiles.length === 0) {
    throw new Error('Add at least one PDF file to run the workflow.');
  }

  const stepLogs: PdfWorkflowStepLog[] = [];
  let workingBytes: Uint8Array;
  let currentPages = 0;

  if (inputFiles.length > 1) {
    onProgress?.(`Step 1: Merging ${inputFiles.length} PDFs...`);
    const merged = await mergePdfBuffers(inputFiles, (cur, total, name) =>
      onProgress?.(`Merging ${cur}/${total}: ${name}...`),
    );
    workingBytes = merged.bytes;
    currentPages = merged.pageCount;
    stepLogs.push({
      step: 'Merge PDFs',
      detail: `Combined ${inputFiles.length} documents (${currentPages} total pages).`,
    });
  } else {
    workingBytes = inputFiles[0].bytes;
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(workingBytes, { ignoreEncryption: false });
    currentPages = doc.getPageCount();
    stepLogs.push({
      step: 'Load PDF',
      detail: `Loaded "${inputFiles[0].name}" (${currentPages} ${
        currentPages === 1 ? 'page' : 'pages'
      }).`,
    });
  }

  if (options.rotateAllDeg !== 0) {
    onProgress?.(`Rotating all pages by ${options.rotateAllDeg}°...`);
    const rotated = await rotatePdfPages(
      workingBytes,
      Array.from({ length: currentPages }, () => options.rotateAllDeg),
      onProgress,
    );
    workingBytes = rotated.bytes;
    stepLogs.push({
      step: 'Rotate Pages',
      detail: `Rotated all ${rotated.pageCount} pages by ${options.rotateAllDeg}°.`,
    });
  }

  if (options.enableWatermark && options.watermarkText.trim()) {
    onProgress?.('Applying watermark...');
    const watermarked = await applyPdfWatermark(
      workingBytes,
      {
        kind: 'text',
        text: options.watermarkText.trim(),
        fontSize: 38,
        colorHex: '#1E293B',
        placement: options.watermarkPlacement,
        opacity: options.watermarkOpacity,
      },
      'all',
      onProgress,
    );
    workingBytes = watermarked.bytes;
    stepLogs.push({
      step: 'Add Watermark',
      detail: `Stamped "${options.watermarkText.trim()}" across ${watermarked.watermarkedPages} pages.`,
    });
  }

  if (options.enablePageNumbers) {
    onProgress?.('Adding page numbers...');
    const numbered = await addPageNumbersToPdf(
      workingBytes,
      {
        position: options.pageNumberPosition,
        format: options.pageNumberFormat,
        startNumber: 1,
        startPage: 1,
        fontSize: 10,
        marginPt: 24,
        colorHex: '#334155',
      },
      onProgress,
    );
    workingBytes = numbered.bytes;
    stepLogs.push({
      step: 'Page Numbers',
      detail: `Numbered ${numbered.numberedPages} pages (${options.pageNumberPosition}).`,
    });
  }

  if (options.enableCompress) {
    onProgress?.('Optimizing internal PDF streams...');
    const compressed = await compressPdfStructure(workingBytes, {
      stripMetadata: options.stripMetadata,
    });
    workingBytes = compressed.bytes;
    stepLogs.push({
      step: 'Optimize Structure',
      detail: options.stripMetadata
        ? 'Rebuilt object streams and stripped document metadata.'
        : 'Rebuilt compressed PDF object streams.',
    });
  }

  if (stepLogs.length === 1 && inputFiles.length === 1) {
    throw new Error('Enable at least one workflow action (or upload 2+ PDFs to merge) before running.');
  }

  return {
    bytes: workingBytes,
    pageCount: currentPages,
    stepLogs,
  };
}
