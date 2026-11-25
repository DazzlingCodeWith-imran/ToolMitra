export interface RenderedPdfPageImage {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  widthPt: number;
  heightPt: number;
  blob: Blob;
  bytes: Uint8Array;
}

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsInitPromise: Promise<PdfJsModule> | null = null;

export async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsInitPromise) {
    pdfjsInitPromise = (async () => {
      if (typeof window === 'undefined') {
        return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
      }
      const [pdfjsLib, workerUrlModule] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      if (typeof workerUrlModule.default === 'string') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;
      }
      return pdfjsLib;
    })();
  }
  return pdfjsInitPromise;
}

export interface PdfJsDocumentHandle {
  doc: Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;
  dispose: () => Promise<void>;
}

export async function openPdfJsDocument(sourceBytes: Uint8Array): Promise<PdfJsDocumentHandle> {
  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({
    data: sourceBytes.slice(),
    useWorkerFetch: false,
  });
  const doc = await loadingTask.promise;
  return {
    doc,
    dispose: async () => {
      await doc.cleanup(false).catch(() => {});
      await loadingTask.destroy().catch(() => {});
    },
  };
}

export async function renderPdfPageToJpegBlob(
  pdfDoc: PdfJsDocumentHandle['doc'],
  pageNumber: number,
  scale: number,
  jpegQuality: number,
): Promise<RenderedPdfPageImage> {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const renderViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(renderViewport.width));
  canvas.height = Math.max(1, Math.round(renderViewport.height));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas context is unavailable.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas,
    viewport: renderViewport,
  }).promise;

  const clampedQuality = Math.max(0.2, Math.min(1, jpegQuality));
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error(`Failed to encode page ${pageNumber} as JPG.`));
      },
      'image/jpeg',
      clampedQuality,
    );
  });

  const buffer = await blob.arrayBuffer();
  page.cleanup();
  canvas.width = 0;
  canvas.height = 0;

  return {
    pageNumber,
    widthPx: Math.max(1, Math.round(renderViewport.width)),
    heightPx: Math.max(1, Math.round(renderViewport.height)),
    widthPt: baseViewport.width,
    heightPt: baseViewport.height,
    blob,
    bytes: new Uint8Array(buffer),
  };
}
