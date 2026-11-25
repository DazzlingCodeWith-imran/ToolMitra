import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Highlighter,
  Loader2,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  applyPdfAnnotations,
  MAX_EDIT_FILE_BYTES,
  type PdfOverlayAnnotation,
} from '@/src/utils/pdfEdit';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedEditPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface EditedOutput {
  url: string;
  filename: string;
  size: number;
  appliedCount: number;
}

type DraftToolMode = 'text' | 'highlight' | 'rect';

export function EditPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedEditPdf | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [annotations, setAnnotations] = useState<PdfOverlayAnnotation[]>([]);

  const [draftMode, setDraftMode] = useState<DraftToolMode>('text');
  const [draftText, setDraftText] = useState('Approved · Reviewed locally');
  const [draftFontSize, setDraftFontSize] = useState(14);
  const [draftColor, setDraftColor] = useState('#1D4ED8');
  const [draftHighlightColor, setDraftHighlightColor] = useState('#FACC15');
  const [draftFillColor, setDraftFillColor] = useState('#FFFFFF');
  const [draftX, setDraftX] = useState(12);
  const [draftY, setDraftY] = useState(15);
  const [draftW, setDraftW] = useState(32);
  const [draftH, setDraftH] = useState(6);
  const [draftOpacity, setDraftOpacity] = useState(40);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<EditedOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string>('');
  const outputUrlRef = useRef<string | null>(null);

  const clearOutput = () => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
    setOutput(null);
  };

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sourcePdf) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
      setPreviewUrl('');
      return;
    }

    let cancelled = false;
    const renderPreview = async () => {
      let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handle = await openPdfJsDocument(sourcePdf.bytes);
        const safePage = Math.min(Math.max(1, activePage), handle.doc.numPages);
        const rendered = await renderPdfPageToJpegBlob(handle.doc, safePage, 1.15, 0.85);
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(rendered.blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        // Fallback cleanly
      } finally {
        if (handle) await handle.dispose();
      }
    };

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [sourcePdf, activePage]);

  const handleLoadPdf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_EDIT_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 50 MB.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setActivePage(1);
      setAnnotations([]);
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const addAnnotation = () => {
    if (!sourcePdf) return;
    clearOutput();
    setErrorMessage(null);

    if (draftMode === 'text') {
      if (!draftText.trim()) {
        setErrorMessage('Enter text content before adding a text annotation.');
        return;
      }
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setAnnotations((prev) => [
        ...prev,
        {
          id,
          type: 'text',
          pageNumber: activePage,
          xPercent: draftX,
          yPercent: draftY,
          text: draftText.trim(),
          fontSize: draftFontSize,
          colorHex: draftColor,
        },
      ]);
      return;
    }

    if (draftMode === 'highlight') {
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setAnnotations((prev) => [
        ...prev,
        {
          id,
          type: 'highlight',
          pageNumber: activePage,
          xPercent: draftX,
          yPercent: draftY,
          widthPercent: draftW,
          heightPercent: draftH,
          colorHex: draftHighlightColor,
          opacity: draftOpacity / 100,
        },
      ]);
      return;
    }

    const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setAnnotations((prev) => [
      ...prev,
      {
        id,
        type: 'rect',
        pageNumber: activePage,
        xPercent: draftX,
        yPercent: draftY,
        widthPercent: draftW,
        heightPercent: draftH,
        fillColorHex: draftFillColor,
        borderColorHex: draftColor,
        opacity: Math.max(0.25, draftOpacity / 100),
      },
    ]);
  };

  const handleSavePdf = async () => {
    if (!sourcePdf) return;
    if (annotations.length === 0) {
      setErrorMessage('Add at least one text note, highlight, or box annotation before saving.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsSaving(true);
    setStatusMessage('Writing annotations to PDF...');

    try {
      const res = await applyPdfAnnotations(sourcePdf.bytes, annotations, (msg) =>
        setStatusMessage(msg),
      );
      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-edited.pdf`,
        size: blob.size,
        appliedCount: res.appliedCount,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save PDF edits.');
      setStatusMessage(null);
    } finally {
      setIsSaving(false);
    }
  };

  const currentPageAnnotations = annotations.filter((a) => a.pageNumber === activePage);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setIsDragging(false);
          void handleLoadPdf(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="edit-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void handleLoadPdf(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <FileUp className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {sourcePdf
            ? `Loaded: ${sourcePdf.file.name} (${sourcePdf.pageCount} ${
                sourcePdf.pageCount === 1 ? 'page' : 'pages'
              })`
            : 'Drop a PDF document here to add text notes, highlights, or callout boxes'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Overlay annotations rendered locally
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isSaving}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isSaving}
              onClick={() => {
                clearOutput();
                setSourcePdf(null);
                setAnnotations([]);
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {(isLoadingFile || isSaving || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Saving PDF...'}</p>
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

      {output && (
        <div
          role="status"
          className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center dark:border-emerald-900/60 dark:bg-emerald-950/40"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                Edited PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                {output.appliedCount} annotation{output.appliedCount === 1 ? '' : 's'} saved ·{' '}
                {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Edited PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Controls */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div
              role="tablist"
              aria-label="Annotation tool mode"
              className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950"
            >
              {(
                [
                  { id: 'text', label: 'Add Text', Icon: Type },
                  { id: 'highlight', label: 'Highlight', Icon: Highlighter },
                  { id: 'rect', label: 'Shape Box', Icon: Square },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = draftMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDraftMode(id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {draftMode === 'text' ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="edit-pdf-text"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Text Note
                  </label>
                  <input
                    id="edit-pdf-text"
                    type="text"
                    maxLength={200}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="edit-pdf-fontsize"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Font Size ({draftFontSize} pt)
                    </label>
                    <input
                      id="edit-pdf-fontsize"
                      type="range"
                      min={8}
                      max={48}
                      value={draftFontSize}
                      onChange={(e) => setDraftFontSize(Number(e.target.value))}
                      className="mt-2 w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Text Color
                    </span>
                    <div className="mt-1.5 flex gap-2">
                      {['#0F172A', '#1D4ED8', '#DC2626', '#047857'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Select color ${c}`}
                          onClick={() => setDraftColor(c)}
                          style={{ backgroundColor: c }}
                          className={`h-6 w-6 rounded-full border-2 ${
                            draftColor === c ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-white'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Width: {draftW}%
                    </span>
                    <input
                      type="range"
                      aria-label="Box width percentage"
                      min={5}
                      max={90}
                      value={draftW}
                      onChange={(e) => setDraftW(Number(e.target.value))}
                      className="mt-1 w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Height: {draftH}%
                    </span>
                    <input
                      type="range"
                      aria-label="Box height percentage"
                      min={2}
                      max={50}
                      value={draftH}
                      onChange={(e) => setDraftH(Number(e.target.value))}
                      className="mt-1 w-full accent-blue-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Color:
                    </span>
                    {(draftMode === 'highlight'
                      ? ['#FACC15', '#4ADE80', '#60A5FA', '#F472B6']
                      : ['#FFFFFF', '#FEF08A', '#DBEAFE', '#FEE2E2']
                    ).map((c) => {
                      const active =
                        draftMode === 'highlight'
                          ? draftHighlightColor === c
                          : draftFillColor === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          onClick={() =>
                            draftMode === 'highlight'
                              ? setDraftHighlightColor(c)
                              : setDraftFillColor(c)
                          }
                          style={{ backgroundColor: c }}
                          className={`h-6 w-6 rounded-full border ${
                            active
                              ? 'border-blue-600 ring-2 ring-blue-500/30'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="w-28">
                    <span className="text-xs text-slate-500">Opacity {draftOpacity}%</span>
                    <input
                      type="range"
                      aria-label="Annotation opacity"
                      min={15}
                      max={90}
                      value={draftOpacity}
                      onChange={(e) => setDraftOpacity(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div>
                <span className="text-xs text-slate-500">X Position: {draftX}%</span>
                <input
                  type="range"
                  aria-label="Horizontal X percent"
                  min={0}
                  max={92}
                  value={draftX}
                  onChange={(e) => setDraftX(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>
              <div>
                <span className="text-xs text-slate-500">Y Position: {draftY}%</span>
                <input
                  type="range"
                  aria-label="Vertical Y percent"
                  min={0}
                  max={94}
                  value={draftY}
                  onChange={(e) => setDraftY(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addAnnotation}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add to Page {activePage}</span>
            </button>

            {/* Queued annotations */}
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Queued Annotations ({annotations.length})
                </span>
                {annotations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnnotations([]);
                      clearOutput();
                    }}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {annotations.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click the page preview to set coordinates, then click &ldquo;Add to Page&rdquo;.
                </p>
              ) : (
                <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {annotations.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => setActivePage(item.pageNumber)}
                        className="min-w-0 flex-1 truncate text-left text-slate-700 hover:text-blue-600 dark:text-slate-300"
                      >
                        <span className="font-mono font-semibold text-slate-500">
                          P{item.pageNumber}
                        </span>{' '}
                        ·{' '}
                        {item.type === 'text'
                          ? `Text: "${item.text}"`
                          : item.type === 'highlight'
                            ? `Highlight (${item.widthPercent}%×${item.heightPercent}%)`
                            : `Box (${item.widthPercent}%×${item.heightPercent}%)`}
                      </button>
                      <button
                        type="button"
                        aria-label="Remove annotation"
                        onClick={() => {
                          setAnnotations((prev) => prev.filter((a) => a.id !== item.id));
                          clearOutput();
                        }}
                        className="rounded p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              disabled={annotations.length === 0 || isSaving || isLoadingFile}
              onClick={() => void handleSavePdf()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSaving ? 'Saving PDF...' : 'Save Edited PDF'}</span>
            </button>
          </div>

          {/* Interactive Page Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Click Page to Position New Annotation
              </h2>
              {sourcePdf.pageCount > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={activePage <= 1}
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Prev
                  </button>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {activePage}/{sourcePdf.pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={activePage >= sourcePdf.pageCount}
                    onClick={() => setActivePage((p) => Math.min(sourcePdf.pageCount, p + 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-[340px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              {previewUrl ? (
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    setDraftX(Math.max(0, Math.min(92, x)));
                    setDraftY(Math.max(0, Math.min(94, y)));
                  }}
                  className="relative inline-block cursor-crosshair overflow-hidden rounded border border-slate-300 bg-white shadow-xs"
                >
                  <img
                    src={previewUrl}
                    alt={`Page ${activePage} preview`}
                    className="block max-h-[420px] w-auto select-none object-contain"
                  />

                  {/* Committed annotations for active page */}
                  {currentPageAnnotations.map((item) => {
                    if (item.type === 'text') {
                      return (
                        <span
                          key={item.id}
                          style={{
                            left: `${item.xPercent}%`,
                            top: `${item.yPercent}%`,
                            color: item.colorHex,
                            fontSize: `${Math.max(10, Math.round(item.fontSize * 0.72))}px`,
                          }}
                          className="pointer-events-none absolute whitespace-nowrap font-sans leading-none"
                        >
                          {item.text}
                        </span>
                      );
                    }
                    if (item.type === 'highlight') {
                      return (
                        <div
                          key={item.id}
                          style={{
                            left: `${item.xPercent}%`,
                            top: `${item.yPercent}%`,
                            width: `${item.widthPercent}%`,
                            height: `${item.heightPercent}%`,
                            backgroundColor: item.colorHex,
                            opacity: item.opacity,
                          }}
                          className="pointer-events-none absolute"
                        />
                      );
                    }
                    return (
                      <div
                        key={item.id}
                        style={{
                          left: `${item.xPercent}%`,
                          top: `${item.yPercent}%`,
                          width: `${item.widthPercent}%`,
                          height: `${item.heightPercent}%`,
                          backgroundColor: item.fillColorHex,
                          borderColor: item.borderColorHex,
                          opacity: item.opacity,
                        }}
                        className="pointer-events-none absolute border"
                      />
                    );
                  })}

                  {/* Active placement target crosshair */}
                  <div
                    style={{
                      left: `${draftX}%`,
                      top: `${draftY}%`,
                      ...(draftMode !== 'text'
                        ? { width: `${draftW}%`, height: `${draftH}%` }
                        : {}),
                    }}
                    className="pointer-events-none absolute rounded-xs border-2 border-dashed border-blue-600 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                  >
                    {draftMode === 'text' ? draftText.slice(0, 24) || 'Text' : ''}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rendering page preview...
                </p>
              )}
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
          Adds text notes, transparent highlights, and rectangular callouts directly onto PDF pages
          in browser memory. Existing embedded PDF text lines remain untouched; for irreversible
          removal of sensitive content, use Redact PDF.
        </p>
      </div>
    </div>
  );
}
