import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  ImagePlus,
  Loader2,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { openPdfJsDocument, renderPdfPageToJpegBlob } from '@/src/utils/pdfRender';
import { MAX_SIGN_FILE_BYTES, placeSignatureOnPdf } from '@/src/utils/pdfSign';
import { parsePageRanges, sanitizeBasePdfName } from '@/src/utils/pdfSplit';

type SignatureSourceMode = 'draw' | 'type' | 'upload';

interface LoadedSignPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface SignedOutput {
  url: string;
  filename: string;
  size: number;
  signedPages: number;
}

export function SignPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedSignPdf | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [sigMode, setSigMode] = useState<SignatureSourceMode>('draw');
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const [typedName, setTypedName] = useState('Aarav Sharma');
  const [inkColor, setInkColor] = useState('#0F172A');

  const [sigImageBytes, setSigImageBytes] = useState<Uint8Array | null>(null);
  const [sigImageMime, setSigImageMime] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string>('');

  const [xPercent, setXPercent] = useState<number>(62);
  const [yPercent, setYPercent] = useState<number>(78);
  const [widthPercent, setWidthPercent] = useState<number>(24);
  const [applyPagesMode, setApplyPagesMode] = useState<'current' | 'all' | 'range'>('current');
  const [rangeInput, setRangeInput] = useState<string>('1');

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<SignedOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sigUploadRef = useRef<HTMLInputElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const previewUrlRef = useRef<string>('');
  const sigPreviewUrlRef = useRef<string>('');
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
      if (sigPreviewUrlRef.current) URL.revokeObjectURL(sigPreviewUrlRef.current);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  // Render target PDF page preview
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
    const render = async () => {
      let handle: Awaited<ReturnType<typeof openPdfJsDocument>> | null = null;
      try {
        handle = await openPdfJsDocument(sourcePdf.bytes);
        const safePage = Math.min(Math.max(1, previewPage), handle.doc.numPages);
        const rendered = await renderPdfPageToJpegBlob(handle.doc, safePage, 1.1, 0.85);
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

    void render();
    return () => {
      cancelled = true;
    };
  }, [sourcePdf, previewPage]);

  // Keep typed signature synced to PNG bytes when in 'type' mode
  useEffect(() => {
    if (sigMode !== 'type') return;
    const clean = typedName.trim();
    if (!clean || typeof document === 'undefined') {
      setSigImageBytes(null);
      return;
    }

    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = inkColor;
    ctx.font = 'italic 54px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(clean, canvas.width / 2, canvas.height / 2, canvas.width - 32);

    canvas.toBlob(async (blob) => {
      if (!blob || cancelled) return;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (cancelled) return;
      if (sigPreviewUrlRef.current) URL.revokeObjectURL(sigPreviewUrlRef.current);
      const url = URL.createObjectURL(blob);
      sigPreviewUrlRef.current = url;
      setSigImageBytes(bytes);
      setSigImageMime('image/png');
      setSigPreviewUrl(url);
    }, 'image/png');

    return () => {
      cancelled = true;
    };
  }, [sigMode, typedName, inkColor]);

  const exportDrawnCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (sigPreviewUrlRef.current) URL.revokeObjectURL(sigPreviewUrlRef.current);
      const url = URL.createObjectURL(blob);
      sigPreviewUrlRef.current = url;
      setSigImageBytes(bytes);
      setSigImageMime('image/png');
      setSigPreviewUrl(url);
    }, 'image/png');
  };

  const getCanvasPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPoint(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    setHasDrawnStroke(true);
    clearOutput();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    exportDrawnCanvas();
  };

  const clearDrawnSignature = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnStroke(false);
    setSigImageBytes(null);
    if (sigPreviewUrlRef.current) {
      URL.revokeObjectURL(sigPreviewUrlRef.current);
      sigPreviewUrlRef.current = '';
    }
    setSigPreviewUrl('');
    clearOutput();
  };

  const handleSigUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearOutput();
    setErrorMessage(null);

    const lower = file.name.toLowerCase();
    const isPng = file.type === 'image/png' || lower.endsWith('.png');
    const isJpg = file.type === 'image/jpeg' || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    if (!isPng && !isJpg) {
      setErrorMessage('Signature image must be PNG or JPG.');
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sigPreviewUrlRef.current) URL.revokeObjectURL(sigPreviewUrlRef.current);
    const url = URL.createObjectURL(file);
    sigPreviewUrlRef.current = url;
    setSigImageBytes(bytes);
    setSigImageMime(isPng ? 'image/png' : 'image/jpeg');
    setSigPreviewUrl(url);
  };

  const handlePdfLoad = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_SIGN_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 50 MB.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await inspectPdfBytes(bytes, file.name);
      setSourcePdf({ file, bytes, size: file.size, pageCount });
      setPreviewPage(1);
      setRangeInput(pageCount > 1 ? `1-${pageCount}` : '1');
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(err instanceof Error ? err.message : `Could not read "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const targetPagePlan = useMemo(() => {
    if (!sourcePdf) return { valid: false, pages: [] as number[], error: null as string | null };
    if (applyPagesMode === 'current') {
      return { valid: true, pages: [previewPage], error: null };
    }
    if (applyPagesMode === 'all') {
      return {
        valid: true,
        pages: Array.from({ length: sourcePdf.pageCount }, (_, i) => i + 1),
        error: null,
      };
    }
    const parsed = parsePageRanges(rangeInput, sourcePdf.pageCount);
    if (!parsed.valid) return { valid: false, pages: [] as number[], error: parsed.error };
    return { valid: true, pages: parsed.flatUniquePages, error: null };
  }, [sourcePdf, applyPagesMode, previewPage, rangeInput]);

  const handleSignPdf = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF document first.');
      return;
    }
    if (!sigImageBytes || (sigMode === 'draw' && !hasDrawnStroke)) {
      setErrorMessage('Create or upload your signature before signing.');
      return;
    }
    if (!targetPagePlan.valid || targetPagePlan.pages.length === 0) {
      setErrorMessage(targetPagePlan.error || 'Select valid page(s) to sign.');
      return;
    }

    clearOutput();
    setErrorMessage(null);
    setIsSigning(true);
    setStatusMessage('Placing signature onto PDF...');

    try {
      const res = await placeSignatureOnPdf(
        sourcePdf.bytes,
        sigImageBytes,
        sigImageMime,
        {
          pageNumbers: targetPagePlan.pages,
          xPercent,
          yPercent,
          widthPercent,
        },
        (msg) => setStatusMessage(msg),
      );
      const blob = new Blob([res.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-signed.pdf`,
        size: blob.size,
        signedPages: res.signedPages,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to sign PDF.');
      setStatusMessage(null);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setIsDraggingFile(false);
          void handlePdfLoad(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDraggingFile
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="sign-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void handlePdfLoad(e.target.files);
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
            : 'Drop a PDF file here to draw, type, or place an electronic signature'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Signed locally without uploading documents
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isSigning}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isSigning}
              onClick={() => {
                clearOutput();
                setSourcePdf(null);
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

      {(isLoadingFile || isSigning || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Applying signature...'}</p>
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
                Signed PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                Signature placed on {output.signedPages}{' '}
                {output.signedPages === 1 ? 'page' : 'pages'} · {formatBytes(output.size)}
              </p>
            </div>
          </div>

          <a
            href={output.url}
            download={output.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Signed PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Signature Creation & Position */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
            <div
              role="tablist"
              aria-label="Signature input method"
              className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950"
            >
              {(
                [
                  { id: 'draw', label: 'Draw' },
                  { id: 'type', label: 'Type' },
                  { id: 'upload', label: 'Upload Image' },
                ] as const
              ).map((tab) => {
                const active = sigMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setSigMode(tab.id);
                      clearOutput();
                    }}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {sigMode === 'draw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Draw your signature inside the box
                  </span>
                  <button
                    type="button"
                    onClick={clearDrawnSignature}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Clear pad</span>
                  </button>
                </div>
                <canvas
                  ref={drawCanvasRef}
                  width={480}
                  height={160}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}
                  className="h-36 w-full touch-none rounded-lg border border-slate-300 bg-white dark:border-slate-700"
                />
              </div>
            )}

            {sigMode === 'type' && (
              <div>
                <label
                  htmlFor="sign-typed-name"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Full Name / Initials
                </label>
                <input
                  id="sign-typed-name"
                  type="text"
                  maxLength={50}
                  value={typedName}
                  onChange={(e) => {
                    setTypedName(e.target.value);
                    clearOutput();
                  }}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            )}

            {sigMode === 'upload' && (
              <div>
                <input
                  ref={sigUploadRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => void handleSigUpload(e)}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => sigUploadRef.current?.click()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  <span>Upload Signature Image (PNG / JPG)</span>
                </button>
              </div>
            )}

            {sigMode !== 'upload' && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ink Color:
                </span>
                {['#0F172A', '#1D4ED8', '#047857'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Ink color ${color}`}
                    onClick={() => {
                      setInkColor(color);
                      clearOutput();
                    }}
                    style={{ backgroundColor: color }}
                    className={`h-6 w-6 rounded-full border-2 ${
                      inkColor === color
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-white dark:border-slate-800'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Placement Sliders */}
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Position &amp; Size on Page (or click preview to place)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-xs text-slate-500">Horizontal: {xPercent}%</span>
                  <input
                    type="range"
                    aria-label="Signature horizontal position"
                    min={0}
                    max={85}
                    value={xPercent}
                    onChange={(e) => {
                      setXPercent(Number(e.target.value));
                      clearOutput();
                    }}
                    className="mt-1 w-full accent-blue-600"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Vertical: {yPercent}%</span>
                  <input
                    type="range"
                    aria-label="Signature vertical position"
                    min={0}
                    max={90}
                    value={yPercent}
                    onChange={(e) => {
                      setYPercent(Number(e.target.value));
                      clearOutput();
                    }}
                    className="mt-1 w-full accent-blue-600"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Width: {widthPercent}%</span>
                  <input
                    type="range"
                    aria-label="Signature width"
                    min={8}
                    max={55}
                    value={widthPercent}
                    onChange={(e) => {
                      setWidthPercent(Number(e.target.value));
                      clearOutput();
                    }}
                    className="mt-1 w-full accent-blue-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="Pages to sign"
                  value={applyPagesMode}
                  onChange={(e) => {
                    setApplyPagesMode(e.target.value as 'current' | 'all' | 'range');
                    clearOutput();
                  }}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="current">Current Page Only (Page {previewPage})</option>
                  <option value="all">All Pages ({sourcePdf.pageCount})</option>
                  <option value="range">Custom Range</option>
                </select>
                {applyPagesMode === 'range' && (
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => {
                      setRangeInput(e.target.value);
                      clearOutput();
                    }}
                    placeholder="e.g., 1, 3-4"
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                )}
              </div>
              {applyPagesMode === 'range' && !targetPagePlan.valid && targetPagePlan.error && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {targetPagePlan.error}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!targetPagePlan.valid || isSigning || isLoadingFile}
              onClick={() => void handleSignPdf()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isSigning ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <PenTool className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSigning ? 'Signing PDF...' : 'Sign & Save PDF'}</span>
            </button>
          </div>

          {/* Interactive Page Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Click Page to Position Signature
              </h2>
              {sourcePdf.pageCount > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Prev
                  </button>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {previewPage}/{sourcePdf.pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={previewPage >= sourcePdf.pageCount}
                    onClick={() => setPreviewPage((p) => Math.min(sourcePdf.pageCount, p + 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              {previewUrl ? (
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    setXPercent(Math.max(0, Math.min(85, x - Math.round(widthPercent / 2))));
                    setYPercent(Math.max(0, Math.min(90, y - 4)));
                    clearOutput();
                  }}
                  className="relative inline-block cursor-crosshair overflow-hidden rounded border border-slate-300 bg-white shadow-xs"
                >
                  <img
                    src={previewUrl}
                    alt={`Page ${previewPage} preview`}
                    className="block max-h-96 w-auto select-none object-contain"
                  />
                  {sigPreviewUrl && (
                    <img
                      src={sigPreviewUrl}
                      alt="Signature overlay preview"
                      style={{
                        left: `${xPercent}%`,
                        top: `${yPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                      className="pointer-events-none absolute rounded border border-dashed border-blue-500/70 bg-white/40 object-contain"
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading page preview...</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p>
          Places a visual electronic signature directly into your PDF inside browser memory without
          uploading documents. Note: this adds a visual signature graphic, not a cryptographic
          PKCS#12/CA digital certificate.
        </p>
      </div>
    </div>
  );
}
