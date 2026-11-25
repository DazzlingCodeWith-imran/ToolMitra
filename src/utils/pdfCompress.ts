import { hasPdfSignature } from '@/src/utils/pdfMerge';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';

export const MAX_COMPRESS_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type CompressionPreset = 'lossless' | 'balanced' | 'strong' | 'extreme';

export interface CompressionPresetConfig {
  id: CompressionPreset;
  label: string;
  description: string;
  scale?: number;
  jpegQuality?: number;
}

export const COMPRESSION_PRESETS: CompressionPresetConfig[] = [
  {
    id: 'lossless',
    label: 'Lossless Structure',
    description:
      'Preserves selectable text and vector graphics while compacting PDF streams and stripping metadata.',
  },
  {
    id: 'balanced',
    label: 'Balanced (Recommended)',
    description:
      'Re-encodes pages at clear reading resolution (130 DPI) for strong size reduction on scans and slides.',
    scale: 130 / 72,
    jpegQuality: 0.78,
  },
  {
    id: 'strong',
    label: 'Strong Compression',
    description:
      'Compacts image-heavy PDFs further at ~105 DPI for faster email and portal uploads.',
    scale: 105 / 72,
    jpegQuality: 0.62,
  },
  {
    id: 'extreme',
    label: 'Maximum Compression',
    description:
      'Smallest file size at ~82 DPI; best when strict upload size limits matter more than fine detail.',
    scale: 82 / 72,
    jpegQuality: 0.45,
  },
];

export interface JpegPageForPdf {
  jpegBytes: Uint8Array;
  widthPt: number;
  heightPt: number;
}

export interface CompressPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  preset: CompressionPreset;
}

export async function compressPdfStructure(
  sourceBytes: Uint8Array,
  options: { stripMetadata?: boolean } = { stripMetadata: true },
): Promise<CompressPdfResult> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  const { PDFDocument } = await import('pdf-lib');

  let sourceDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before compressing.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  // Copy all pages into a fresh PDFDocument to drop orphaned/unused unreferenced objects
  const cleanDoc = await PDFDocument.create();
  const pageIndices = sourceDoc.getPageIndices();
  const copiedPages = await cleanDoc.copyPages(sourceDoc, pageIndices);
  for (const page of copiedPages) {
    cleanDoc.addPage(page);
  }

  if (options.stripMetadata !== false) {
    cleanDoc.setTitle('');
    cleanDoc.setAuthor('');
    cleanDoc.setSubject('');
    cleanDoc.setKeywords([]);
    cleanDoc.setProducer('');
    cleanDoc.setCreator('');
  }

  const bytes = await cleanDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return {
    bytes,
    pageCount: cleanDoc.getPageCount(),
    preset: 'lossless',
  };
}

export async function buildPdfFromJpegPages(
  pages: JpegPageForPdf[],
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (pages.length === 0) {
    throw new Error('No pages available to assemble compressed PDF.');
  }

  const { PDFDocument } = await import('pdf-lib');
  const outDoc = await PDFDocument.create();

  for (const item of pages) {
    const embeddedImage = await outDoc.embedJpg(item.jpegBytes);
    const page = outDoc.addPage([item.widthPt, item.heightPt]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: item.widthPt,
      height: item.heightPt,
    });
  }

  const bytes = await outDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: outDoc.getPageCount(),
  };
}

export async function compressPdfDocument(
  sourceBytes: Uint8Array,
  preset: CompressionPreset,
  stripMetadata: boolean,
  onProgress?: (message: string) => void,
): Promise<CompressPdfResult> {
  if (preset === 'lossless') {
    onProgress?.('Optimizing PDF streams and removing unused objects...');
    return await compressPdfStructure(sourceBytes, { stripMetadata });
  }

  const config = COMPRESSION_PRESETS.find((item) => item.id === preset);
  if (!config || !config.scale || !config.jpegQuality) {
    throw new Error('Unknown compression preset.');
  }

  onProgress?.('Loading PDF rendering engine...');
  const handle = await openPdfJsDocument(sourceBytes);

  try {
    const totalPages = handle.doc.numPages;
    const encodedPages: JpegPageForPdf[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      onProgress?.(`Compressing page ${pageNumber} of ${totalPages}...`);
      const rendered = await renderPdfPageToJpegBlob(
        handle.doc,
        pageNumber,
        config.scale,
        config.jpegQuality,
      );
      encodedPages.push({
        jpegBytes: rendered.bytes,
        widthPt: rendered.widthPt,
        heightPt: rendered.heightPt,
      });
    }

    onProgress?.('Assembling compressed PDF...');
    const assembled = await buildPdfFromJpegPages(encodedPages);
    return {
      bytes: assembled.bytes,
      pageCount: assembled.pageCount,
      preset,
    };
  } finally {
    await handle.dispose();
  }
}
