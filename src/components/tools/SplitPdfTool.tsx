import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileText,
  FileUp,
  Loader2,
  Scissors,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import { inspectPdfBytes, isPdfFileCandidate } from '@/src/utils/pdfMerge';
import {
  buildFixedSizeGroups,
  createSplitZipBlob,
  formatPageGroupLabel,
  MAX_SPLIT_FILE_BYTES,
  parsePageRanges,
  sanitizeBasePdfName,
  splitPdfByGroups,
  type SplitPageGroup,
} from '@/src/utils/pdfSplit';

type SplitMode = 'ranges' | 'fixed' | 'select';
type RangeExportBehavior = 'combine' | 'separate';

interface LoadedPdfSource {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
}

interface GeneratedPartWithUrl {
  filename: string;
  label: string;
  pageCount: number;
  size: number;
  url: string;
  bytes: Uint8Array;
}

export function SplitPdfTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedPdfSource | null>(null);
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [rangeInput, setRangeInput] = useState<string>('1');
  const [rangeBehavior, setRangeBehavior] = useState<RangeExportBehavior>('combine');
  const [pagesPerFile, setPagesPerFile] = useState<string>('1');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectBehavior, setSelectBehavior] = useState<RangeExportBehavior>('combine');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<GeneratedPartWithUrl[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const outputUrlsRef = useRef<string[]>([]);

  const revokeOutputs = () => {
    for (const url of outputUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    outputUrlsRef.current = [];
    setOutputs([]);
  };

  useEffect(() => {
    return () => {
      for (const url of outputUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      outputUrlsRef.current = [];
    };
  }, []);

  const loadPdfFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setErrorMessage(null);
    revokeOutputs();

    if (fileList.length > 1) {
      setErrorMessage('Split PDF processes one document at a time. Loaded the first selected file.');
    }

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file. Please select a .pdf document.`);
      return;
    }
    if (file.size === 0) {
      setErrorMessage(`"${file.name}" is empty (0 bytes).`);
      return;
    }
    if (file.size > MAX_SPLIT_FILE_BYTES) {
      setErrorMessage(`"${file.name}" exceeds the 50 MB browser memory limit.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Reading "${file.name}"...`);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const pageCount = await inspectPdfBytes(bytes, file.name);

      setSourcePdf({
        file,
        bytes,
        size: file.size,
        pageCount,
      });

      setRangeInput(pageCount > 1 ? `1-${Math.min(2, pageCount)}` : '1');
      setPagesPerFile('1');
      setSelectedPages(pageCount >= 1 ? [1] : []);
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setErrorMessage(
        err instanceof Error ? err.message : `Could not read "${file.name}" as a valid PDF.`,
      );
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void loadPdfFile(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void loadPdfFile(e.dataTransfer.files);
  };

  const handleClear = () => {
    revokeOutputs();
    setSourcePdf(null);
    setSelectedPages([]);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const parsedRangeResult = useMemo(() => {
    if (!sourcePdf) return null;
    return parsePageRanges(rangeInput, sourcePdf.pageCount);
  }, [sourcePdf, rangeInput]);

  const parsedFixedCount = useMemo(() => {
    const trimmed = pagesPerFile.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }, [pagesPerFile]);

  const toggleSelectedPage = (pageNum: number) => {
    revokeOutputs();
    setErrorMessage(null);
    setSelectedPages((prev) =>
      prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b),
    );
  };

  const selectPresetPages = (preset: 'all' | 'none' | 'odd' | 'even') => {
    if (!sourcePdf) return;
    revokeOutputs();
    setErrorMessage(null);
    if (preset === 'none') {
      setSelectedPages([]);
      return;
    }
    const next: number[] = [];
    for (let p = 1; p <= sourcePdf.pageCount; p++) {
      if (preset === 'all') next.push(p);
      else if (preset === 'odd' && p % 2 === 1) next.push(p);
      else if (preset === 'even' && p % 2 === 0) next.push(p);
    }
    setSelectedPages(next);
  };

  const plannedGroups = useMemo<{
    valid: boolean;
    groups: SplitPageGroup[];
    error: string | null;
  }>(() => {
    if (!sourcePdf) {
      return { valid: false, groups: [], error: null };
    }

    if (mode === 'ranges') {
      if (!parsedRangeResult || !parsedRangeResult.valid) {
        return {
          valid: false,
          groups: [],
          error: parsedRangeResult?.error ?? 'Enter valid page ranges.',
        };
      }
      if (rangeBehavior === 'combine') {
        return {
          valid: true,
          groups: [
            {
              label: formatPageGroupLabel(parsedRangeResult.flatUniquePages),
              pages: parsedRangeResult.flatUniquePages,
            },
          ],
          error: null,
        };
      }
      return {
        valid: true,
        groups: parsedRangeResult.groups.map((g) => ({
          label: formatPageGroupLabel(g),
          pages: g,
        })),
        error: null,
      };
    }

    if (mode === 'fixed') {
      if (!parsedFixedCount) {
        return {
          valid: false,
          groups: [],
          error: 'Enter a whole number of 1 or more pages per output file.',
        };
      }
      if (parsedFixedCount > sourcePdf.pageCount) {
        return {
          valid: false,
          groups: [],
          error: `Pages per file (${parsedFixedCount}) cannot exceed total document pages (${sourcePdf.pageCount}).`,
        };
      }
      return {
        valid: true,
        groups: buildFixedSizeGroups(sourcePdf.pageCount, parsedFixedCount),
        error: null,
      };
    }

    // mode === 'select'
    if (selectedPages.length === 0) {
      return {
        valid: false,
        groups: [],
        error: 'Select at least one page from the grid below.',
      };
    }

    const sorted = [...selectedPages].sort((a, b) => a - b);
    if (selectBehavior === 'combine') {
      return {
        valid: true,
        groups: [{ label: formatPageGroupLabel(sorted), pages: sorted }],
        error: null,
      };
    }
    return {
      valid: true,
      groups: sorted.map((p) => ({ label: `Page ${p}`, pages: [p] })),
      error: null,
    };
  }, [sourcePdf, mode, parsedRangeResult, rangeBehavior, parsedFixedCount, selectedPages, selectBehavior]);

  const handleSplit = async () => {
    if (!sourcePdf) {
      setErrorMessage('Upload a PDF file first.');
      return;
    }
    if (!plannedGroups.valid || plannedGroups.groups.length === 0) {
      setErrorMessage(plannedGroups.error || 'Select valid pages to split.');
      return;
    }

    revokeOutputs();
    setErrorMessage(null);
    setIsSplitting(true);
    setStatusMessage('Loading PDF engine...');

    try {
      const baseName = sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra-split');
      const parts = await splitPdfByGroups(
        sourcePdf.bytes,
        plannedGroups.groups,
        baseName,
        (current, total) => {
          setStatusMessage(`Creating PDF ${current} of ${total}...`);
        },
      );

      const createdUrls: string[] = [];
      const withUrls: GeneratedPartWithUrl[] = parts.map((part) => {
        const blob = new Blob([part.bytes.slice()], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        return {
          filename: part.filename,
          label: part.label,
          pageCount: part.pageCount,
          size: blob.size,
          url,
          bytes: part.bytes,
        };
      });

      outputUrlsRef.current = createdUrls;
      setOutputs(withUrls);
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to split PDF. Please check the file.',
      );
      setStatusMessage(null);
    } finally {
      setIsSplitting(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (outputs.length === 0 || !sourcePdf) return;
    setIsZipping(true);
    setErrorMessage(null);
    try {
      const zipBlob = await createSplitZipBlob(
        outputs.map((item) => ({
          filename: item.filename,
          label: item.label,
          pageCount: item.pageCount,
          pages: [],
          bytes: item.bytes,
        })),
      );
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra-split')}-pages.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorMessage('Could not create ZIP archive. You can download individual PDFs below.');
    } finally {
      setIsZipping(false);
    }
  };

  const modeTabs: Array<{ id: SplitMode; label: string }> = [
    { id: 'ranges', label: 'Page Ranges' },
    { id: 'fixed', label: 'Split Every N Pages' },
    { id: 'select', label: 'Select Pages' },
  ];

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          id="split-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="sr-only"
        />
        <FileUp
          className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {sourcePdf
            ? `Loaded: ${sourcePdf.file.name} (${sourcePdf.pageCount} ${
                sourcePdf.pageCount === 1 ? 'page' : 'pages'
              })`
            : 'Drop a PDF file here to split or extract pages'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Processed locally inside your browser
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isSplitting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Reading PDF...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF File'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isSplitting}
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {(isLoadingFile || isSplitting || statusMessage) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <p>{statusMessage || 'Processing PDF locally...'}</p>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Split Controls */}
      {sourcePdf && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          {/* File Metadata Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-400">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {sourcePdf.file.name}
                </p>
                <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {sourcePdf.pageCount} {sourcePdf.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                  {formatBytes(sourcePdf.size)}
                </p>
              </div>
            </div>

            {plannedGroups.valid && (
              <p className="font-mono text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                Will create {plannedGroups.groups.length}{' '}
                {plannedGroups.groups.length === 1 ? 'PDF file' : 'PDF files'}
              </p>
            )}
          </div>

          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="Split mode"
            className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950"
          >
            {modeTabs.map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setMode(tab.id);
                    setErrorMessage(null);
                    revokeOutputs();
                  }}
                  className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
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

          {/* Mode 1: Custom Ranges */}
          {mode === 'ranges' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="split-range-input"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Page Ranges
                  </label>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Valid pages: 1–{sourcePdf.pageCount}
                  </span>
                </div>
                <input
                  id="split-range-input"
                  type="text"
                  value={rangeInput}
                  onChange={(e) => {
                    setRangeInput(e.target.value);
                    revokeOutputs();
                  }}
                  placeholder={sourcePdf.pageCount > 1 ? `1-${sourcePdf.pageCount}` : '1'}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Separate pages or ranges with commas (example: <code className="font-mono">1-3, 5, 8-10</code>).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                  <input
                    type="radio"
                    name="range-behavior"
                    checked={rangeBehavior === 'combine'}
                    onChange={() => {
                      setRangeBehavior('combine');
                      revokeOutputs();
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span>
                    <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Extract into one PDF
                    </strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Merge all entered pages into a single output file.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                  <input
                    type="radio"
                    name="range-behavior"
                    checked={rangeBehavior === 'separate'}
                    onChange={() => {
                      setRangeBehavior('separate');
                      revokeOutputs();
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span>
                    <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Separate PDF per range
                    </strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Create one PDF file for each comma-separated range.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Mode 2: Fixed Page Count */}
          {mode === 'fixed' && (
            <div className="space-y-3">
              <label
                htmlFor="split-fixed-count"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Pages per Output File
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="split-fixed-count"
                  type="number"
                  min={1}
                  max={sourcePdf.pageCount}
                  value={pagesPerFile}
                  onChange={(e) => {
                    setPagesPerFile(e.target.value);
                    revokeOutputs();
                  }}
                  className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 5, 10]
                    .filter((preset) => preset <= sourcePdf.pageCount)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setPagesPerFile(String(preset));
                          revokeOutputs();
                        }}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Every {preset} {preset === 1 ? 'page' : 'pages'}
                      </button>
                    ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set to <code className="font-mono">1</code> to extract every page into its own PDF file.
              </p>
            </div>
          )}

          {/* Mode 3: Select Individual Pages */}
          {mode === 'select' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Selected: {selectedPages.length} of {sourcePdf.pageCount}{' '}
                  {sourcePdf.pageCount === 1 ? 'page' : 'pages'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => selectPresetPages('all')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetPages('odd')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Odd Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetPages('even')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Even Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetPages('none')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-8 md:grid-cols-10 dark:border-slate-800 dark:bg-slate-950">
                {Array.from({ length: sourcePdf.pageCount }, (_, i) => i + 1).map((pageNum) => {
                  const isSelected = selectedPages.includes(pageNum);
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSelectedPage(pageNum)}
                      className={`h-9 rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500 dark:text-slate-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                  <input
                    type="radio"
                    name="select-behavior"
                    checked={selectBehavior === 'combine'}
                    onChange={() => {
                      setSelectBehavior('combine');
                      revokeOutputs();
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span>
                    <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Combine into one PDF
                    </strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Save selected pages together as one document.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                  <input
                    type="radio"
                    name="select-behavior"
                    checked={selectBehavior === 'separate'}
                    onChange={() => {
                      setSelectBehavior('separate');
                      revokeOutputs();
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span>
                    <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      One PDF per selected page
                    </strong>
                    <span className="text-slate-500 dark:text-slate-400">
                      Export each selected page as a standalone PDF.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Inline Plan Validation Message */}
          {!plannedGroups.valid && plannedGroups.error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {plannedGroups.error}
            </p>
          )}

          {/* Split Trigger */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={!plannedGroups.valid || isSplitting || isLoadingFile}
              onClick={() => void handleSplit()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              {isSplitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Scissors className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSplitting ? 'Splitting PDF...' : 'Split PDF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Generated Output Files */}
      {outputs.length > 0 && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  Created {outputs.length} {outputs.length === 1 ? 'PDF file' : 'PDF files'} locally
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  {outputs.length === 1
                    ? 'Click Download PDF below to save your extracted pages.'
                    : 'Download individual PDFs below or save all files together as a ZIP archive.'}
                </p>
              </div>
            </div>

            {outputs.length > 1 && (
              <button
                type="button"
                disabled={isZipping}
                onClick={() => void handleDownloadAllZip()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <FileArchive className="h-4 w-4" aria-hidden="true" />
                <span>{isZipping ? 'Creating ZIP...' : 'Download All (ZIP)'}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {outputs.map((part) => (
              <div
                key={part.filename}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {part.filename}
                  </p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {part.label} · {part.pageCount} {part.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                    {formatBytes(part.size)}
                  </p>
                </div>

                <a
                  href={part.url}
                  download={part.filename}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download PDF</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Privacy Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          All page splitting happens strictly in your browser memory—no PDF leaves your device or is
          stored on any server. Password-protected PDFs must be unlocked before splitting.
        </p>
      </div>
    </div>
  );
}
