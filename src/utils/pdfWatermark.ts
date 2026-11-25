import { hasPdfSignature } from '@/src/utils/pdfMerge';

export const MAX_WATERMARK_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type WatermarkKind = 'text' | 'image';
export type WatermarkPlacement = 'diagonal' | 'center' | 'tiled' | 'top-right' | 'bottom-right';

export interface TextWatermarkOptions {
  kind: 'text';
  text: string;
  fontSize: number;
  opacity: number;
  colorHex: string;
  placement: WatermarkPlacement;
}

export interface ImageWatermarkOptions {
  kind: 'image';
  imageBytes: Uint8Array;
  imageType: 'png' | 'jpg';
  scalePercent: number;
  opacity: number;
  placement: WatermarkPlacement;
}

export type WatermarkOptions = TextWatermarkOptions | ImageWatermarkOptions;

export function hexToRgbUnit(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return { r: 0.15, g: 0.25, b: 0.45 };
  const val = parseInt(match[1], 16);
  return {
    r: ((val >> 16) & 255) / 255,
    g: ((val >> 8) & 255) / 255,
    b: (val & 255) / 255,
  };
}

export async function applyPdfWatermark(
  sourceBytes: Uint8Array,
  options: WatermarkOptions,
  targetPageNumbers: number[] | 'all',
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; pageCount: number; watermarkedPages: number }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }
  if (options.kind === 'text' && !options.text.trim()) {
    throw new Error('Enter watermark text before applying.');
  }

  onProgress?.('Loading PDF engine...');
  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before watermarking.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const pages = pdfDoc.getPages();
  const targetSet = targetPageNumbers === 'all' ? null : new Set(targetPageNumbers);
  let watermarkedPages = 0;

  if (options.kind === 'text') {
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { r, g, b } = hexToRgbUnit(options.colorHex);
    const color = rgb(r, g, b);
    const opacity = Math.max(0.05, Math.min(1, options.opacity));
    const fontSize = Math.max(10, Math.min(120, options.fontSize));
    const text = options.text.trim();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    for (let i = 0; i < pages.length; i++) {
      if (targetSet && !targetSet.has(i + 1)) continue;
      onProgress?.(`Watermarking page ${i + 1} of ${pages.length}...`);

      const page = pages[i];
      const { width, height } = page.getSize();

      if (options.placement === 'tiled') {
        const stepX = Math.max(160, textWidth + 70);
        const stepY = Math.max(130, fontSize * 3.2);
        for (let y = 40; y < height; y += stepY) {
          for (let x = 20; x < width; x += stepX) {
            page.drawText(text, {
              x,
              y,
              size: fontSize,
              font,
              color,
              opacity,
              rotate: degrees(35),
            });
          }
        }
      } else if (options.placement === 'diagonal') {
        const angleRad = (45 * Math.PI) / 180;
        const x = width / 2 - (textWidth / 2) * Math.cos(angleRad);
        const y = height / 2 - (textWidth / 2) * Math.sin(angleRad);
        page.drawText(text, {
          x: Math.max(16, x),
          y: Math.max(16, y),
          size: fontSize,
          font,
          color,
          opacity,
          rotate: degrees(45),
        });
      } else if (options.placement === 'center') {
        page.drawText(text, {
          x: Math.max(12, (width - textWidth) / 2),
          y: Math.max(12, (height - fontSize) / 2),
          size: fontSize,
          font,
          color,
          opacity,
        });
      } else if (options.placement === 'top-right') {
        page.drawText(text, {
          x: Math.max(12, width - textWidth - 28),
          y: Math.max(12, height - fontSize - 28),
          size: fontSize,
          font,
          color,
          opacity,
        });
      } else {
        page.drawText(text, {
          x: Math.max(12, width - textWidth - 28),
          y: 28,
          size: fontSize,
          font,
          color,
          opacity,
        });
      }

      watermarkedPages++;
    }
  } else {
    const embedded =
      options.imageType === 'png'
        ? await pdfDoc.embedPng(options.imageBytes)
        : await pdfDoc.embedJpg(options.imageBytes);
    const opacity = Math.max(0.05, Math.min(1, options.opacity));
    const scaleRatio = Math.max(0.08, Math.min(0.8, options.scalePercent / 100));

    for (let i = 0; i < pages.length; i++) {
      if (targetSet && !targetSet.has(i + 1)) continue;
      onProgress?.(`Watermarking page ${i + 1} of ${pages.length}...`);

      const page = pages[i];
      const { width, height } = page.getSize();
      const targetW = width * scaleRatio;
      const targetH = (embedded.height / embedded.width) * targetW;

      let x = (width - targetW) / 2;
      let y = (height - targetH) / 2;
      let rotateDeg = 0;

      if (options.placement === 'diagonal') {
        rotateDeg = 35;
      } else if (options.placement === 'top-right') {
        x = Math.max(16, width - targetW - 24);
        y = Math.max(16, height - targetH - 24);
      } else if (options.placement === 'bottom-right') {
        x = Math.max(16, width - targetW - 24);
        y = 24;
      }

      if (options.placement === 'tiled') {
        const stepX = Math.max(140, targetW + 48);
        const stepY = Math.max(120, targetH + 48);
        for (let ty = 24; ty < height; ty += stepY) {
          for (let tx = 24; tx < width; tx += stepX) {
            page.drawImage(embedded, {
              x: tx,
              y: ty,
              width: targetW * 0.65,
              height: targetH * 0.65,
              opacity,
            });
          }
        }
      } else {
        page.drawImage(embedded, {
          x,
          y,
          width: targetW,
          height: targetH,
          opacity,
          ...(rotateDeg ? { rotate: degrees(rotateDeg) } : {}),
        });
      }

      watermarkedPages++;
    }
  }

  if (watermarkedPages === 0) {
    throw new Error('No matching pages were selected to watermark.');
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pages.length,
    watermarkedPages,
  };
}
