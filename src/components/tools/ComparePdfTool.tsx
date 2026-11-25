import {
  AlertCircle,
  Download,
  FileUp,
  GitCompare,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  computePixelDiffRgba,
  diffTextLines,
  extractPdfLinesPerPage,
  formatComparisonReportMarkdown,
  MAX_COMPARE_FILE_BYTES,
  type PageDiffSummary,
} from '@/src/utils/pdfCompare';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { openPdfJsDocument } from '@/src/utils/pdfRender';

interface LoadedCompareDoc {
  name: string;
  size: number;
  pageCount: number;
  bytes: Uint8Array;
}

export function ComparePdfTool() {
  const [docA, setDocA] = useState<LoadedCompareDoc | null>(null);
  const [docB, setDocB] = useState<LoadedCompareDoc | null>(null);
  const [pageDiffs, setPageDiffs] = useState<PageDiffSummary[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [visualDiffUrl, setVisualDiffUrl] = useState<string>('');
  const [visualDiffPercent, setVisualDiffPercent] = useState<number | null>(null);

  const [isComparing, setIsComparing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputARef = useRef<HTMLInputElement | null>(null);
  const inputBRef = useRef<HTMLInputElement | null>(null);
  const visualDiffUrlRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (visualDiffUrlRef.current) URL.revokeObjectURL(visualDiffUrlRef.current);
    };
  }, []);

  const loadSlot = async (slot: 'A' | 'B', file: File | undefined) => {
    if (!file) return;
    setErrorMessage(null);
    setPageDiffs([]);

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_COMPARE_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 50 MB.`);
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      const loaded: LoadedCompareDoc = { name: file.name, size: file.size, pageCount, bytes };
      if (slot === 'A') setDocA(loaded);
      else setDocB(loaded);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
    }
  };

  // Compute pixel heatmap whenever activePage changes after comparison runs
  useEffect(() => {
    if (!docA || !docB || pageDiffs.length === 0) {
      if (visualDiffUrlRef.current) {
        URL.revokeObjectURL(visualDiffUrlRef.current);
        visualDiffUrlRef.current = '';
      }
      setVisualDiffUrl('');
      setVisualDiffPercent(null);
      return;
    }

    let cancelled = false;
    const renderVisualDiff = async () => {
      let handleA: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      let handleB: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handleA = await openPdfJsDocument(docA.bytes);
        handleB = await openPdfJsDocument(docB.bytes);

        const renderToData = async (
          doc: Awaited<ReturnType<typeof openPdfJsDocument>>['doc'],
          pageNum: number,
        ) => {
          const canvas = document.createElement('canvas');
          if (pageNum > doc.numPages) {
            canvas.width = 400;
            canvas.height = 520;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return ctx.getImageData(0, 0, canvas.width, canvas.height);
          }
          const page = await doc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, viewport }).promise;
          return ctx.getImageData(0, 0, canvas.width, canvas.height);
        };

        const imgA = await renderToData(handleA.doc, activePage);
        const imgB = await renderToData(handleB.doc, activePage);
        if (cancelled) return;

        const w = Math.min(imgA.width, imgB.width);
        const h = Math.min(imgA.height, imgB.height);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) return;

        // Crop both RGBA arrays cleanly to shared bounds if dimensions differ slightly
        const cA = document.createElement('canvas');
        cA.width = w;
        cA.height = h;
        cA.getContext('2d')!.putImageData(imgA, 0, 0);
        const cropA = cA.getContext('2d')!.getImageData(0, 0, w, h).data;

        const cB = document.createElement('canvas');
        cB.width = w;
        cB.height = h;
        cB.getContext('2d')!.putImageData(imgB, 0, 0);
        const cropB = cB.getContext('2d')!.getImageData(0, 0, w, h).data;

        const { diffRgba, changedPixels, totalPixels } = computePixelDiffRgba(cropA, cropB);
        const outImg = outCtx.createImageData(w, h);
        outImg.data.set(diffRgba);
        outCtx.putImageData(outImg, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) =>
          outCanvas.toBlob((b) => resolve(b), 'image/png'),
        );
        if (!blob || cancelled) return;
        if (visualDiffUrlRef.current) URL.revokeObjectURL(visualDiffUrlRef.current);
        const url = URL.createObjectURL(blob);
        visualDiffUrlRef.current = url;
        setVisualDiffUrl(url);
        setVisualDiffPercent(
          totalPixels > 0 ? Number(((changedPixels / totalPixels) * 100).toFixed(2)) : 0,
        );
      } catch {
        // Fallback cleanly
      } finally {
        if (handleA) await handleA.dispose();
        if (handleB) await handleB.dispose();
      }
    };

    void renderVisualDiff();
    return () => {
      cancelled = true;
    };
  }, [docA, docB, pageDiffs, activePage]);

  const handleRunCompare = async () => {
    if (!docA || !docB) {
      setErrorMessage('Upload both Original (PDF A) and Revised (PDF B) files before comparing.');
      return;
    }

    setErrorMessage(null);
    setIsComparing(true);
    setStatusMessage('Extracting text lines from both documents...');

    try {
      const linesA = await extractPdfLinesPerPage(docA.bytes);
      const linesB = await extractPdfLinesPerPage(docB.bytes);
      const maxPages = Math.max(linesA.length, linesB.length);
      const results: PageDiffSummary[] = [];

      for (let i = 0; i < maxPages; i++) {
        const pageNum = i + 1;
        const diff = diffTextLines(linesA[i] ?? [], linesB[i] ?? []);
        results.push({
          pageNumber: pageNum,
          lines: diff.entries,
          addedCount: diff.addedCount,
          removedCount: diff.removedCount,
          unchangedCount: diff.unchangedCount,
        });
      }

      setPageDiffs(results);
      setActivePage(1);
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to compare PDF files.');
      setStatusMessage(null);
    } finally {
      setIsComparing(false);
    }
  };

  const handleDownloadReport = () => {
    if (!docA || !docB || pageDiffs.length === 0) return;
    const report = formatComparisonReportMarkdown(docA.name, docB.name, pageDiffs);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toolmitra-pdf-comparison-report.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const totalAdded = pageDiffs.reduce((sum, p) => sum + p.addedCount, 0);
  const totalRemoved = pageDiffs.reduce((sum, p) => sum + p.removedCount, 0);
  const activeDiff = pageDiffs.find((p) => p.pageNumber === activePage) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* PDF A */}
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <input
            ref={inputARef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              void loadSlot('A', e.target.files?.[0]);
              e.target.value = '';
            }}
            className="sr-only"
          />
          <FileUp className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Original Document (A)
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {docA ? `${docA.name} (${docA.pageCount}p · ${formatBytes(docA.size)})` : 'No file selected'}
          </p>
          <button
            type="button"
            onClick={() => inputARef.current?.click()}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            {docA ? 'Replace Original PDF' : 'Select Original PDF'}
          </button>
        </div>

        {/* PDF B */}
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <input
            ref={inputBRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              void loadSlot('B', e.target.files?.[0]);
              e.target.value = '';
            }}
            className="sr-only"
          />
          <FileUp className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Revised Document (B)
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {docB ? `${docB.name} (${docB.pageCount}p · ${formatBytes(docB.size)})` : 'No file selected'}
          </p>
          <button
            type="button"
            onClick={() => inputBRef.current?.click()}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            {docB ? 'Replace Revised PDF' : 'Select Revised PDF'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!docA || !docB || isComparing}
          onClick={() => void handleRunCompare()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
        >
          {isComparing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <GitCompare className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{isComparing ? 'Comparing PDFs...' : 'Compare Documents'}</span>
        </button>

        {pageDiffs.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Diff Report (.md)</span>
          </button>
        )}
      </div>

      {(isComparing || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {pageDiffs.length > 0 && activeDiff && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">
                Total Changes Across {pageDiffs.length}{' '}
                {pageDiffs.length === 1 ? 'Page' : 'Pages'}:
              </span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                +{totalAdded} added lines
              </span>
              <span className="font-mono text-red-700 dark:text-red-400">
                -{totalRemoved} removed lines
              </span>
            </div>

            {pageDiffs.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={activePage <= 1}
                  onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 px-2.5 py-1 disabled:opacity-40 dark:border-slate-800"
                >
                  Prev Page
                </button>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {activePage}/{pageDiffs.length}
                </span>
                <button
                  type="button"
                  disabled={activePage >= pageDiffs.length}
                  onClick={() => setActivePage((p) => Math.min(pageDiffs.length, p + 1))}
                  className="rounded border border-slate-200 px-2.5 py-1 disabled:opacity-40 dark:border-slate-800"
                >
                  Next Page
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Line Diff */}
            <div className="space-y-2 lg:col-span-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Page {activePage} Text Line Differences
              </h2>
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-950">
                {activeDiff.lines.length === 0 ? (
                  <p className="text-slate-500">No selectable text lines on page {activePage}.</p>
                ) : (
                  activeDiff.lines.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`rounded px-2 py-0.5 ${
                        entry.kind === 'added'
                          ? 'bg-emerald-100/80 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200'
                          : entry.kind === 'removed'
                            ? 'bg-red-100/80 text-red-950 dark:bg-red-950/60 dark:text-red-200'
                            : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="mr-2 select-none font-bold">
                        {entry.kind === 'added' ? '+' : entry.kind === 'removed' ? '-' : ' '}
                      </span>
                      <span>{entry.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Visual Pixel Diff */}
            <div className="space-y-2 lg:col-span-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Visual Pixel Diff Heatmap (Page {activePage})
                </h2>
                {visualDiffPercent !== null && (
                  <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                    {visualDiffPercent}% pixels changed
                  </span>
                )}
              </div>
              <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                {visualDiffUrl ? (
                  <img
                    src={visualDiffUrl}
                    alt={`Page ${activePage} visual pixel differences`}
                    className="max-h-[400px] w-auto rounded border border-slate-200 object-contain"
                  />
                ) : (
                  <p className="text-xs text-slate-500">Rendering visual comparison...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Runs line-by-line text comparison and pixel heatmap analysis locally inside your browser
          memory without uploading either PDF version to a server.
        </p>
      </div>
    </div>
  );
}
