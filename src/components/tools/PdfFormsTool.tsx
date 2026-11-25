import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileUp,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/src/utils/formatBytes';
import {
  fillPdfFormFields,
  inspectPdfFormFields,
  MAX_FORMS_FILE_BYTES,
  type InspectedFormField,
} from '@/src/utils/pdfForms';
import { isPdfFileCandidate } from '@/src/utils/pdfMerge';
import { sanitizeBasePdfName } from '@/src/utils/pdfSplit';

interface LoadedFormPdf {
  file: File;
  bytes: Uint8Array;
  size: number;
  pageCount: number;
  fields: InspectedFormField[];
}

interface FilledFormOutput {
  url: string;
  filename: string;
  size: number;
  updatedCount: number;
  flattened: boolean;
}

export function PdfFormsTool() {
  const [sourcePdf, setSourcePdf] = useState<LoadedFormPdf | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [flattenOnSave, setFlattenOnSave] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [output, setOutput] = useState<FilledFormOutput | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  const handleLoadPdf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setErrorMessage(null);
    clearOutput();

    if (!isPdfFileCandidate(file)) {
      setErrorMessage(`"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_FORMS_FILE_BYTES) {
      setErrorMessage(`"${file.name}" must be between 1 byte and 50 MB.`);
      return;
    }

    setIsLoadingFile(true);
    setStatusMessage(`Scanning "${file.name}" for interactive AcroForm fields...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const inspected = await inspectPdfFormFields(bytes);
      const initialValues: Record<string, string | boolean> = {};
      for (const field of inspected.fields) {
        if (field.kind !== 'unsupported') {
          initialValues[field.name] = field.value;
        }
      }
      setSourcePdf({
        file,
        bytes,
        size: file.size,
        pageCount: inspected.pageCount,
        fields: inspected.fields,
      });
      setFormValues(initialValues);
      setStatusMessage(null);
    } catch (err) {
      setSourcePdf(null);
      setFormValues({});
      setErrorMessage(err instanceof Error ? err.message : `Could not inspect "${file.name}".`);
      setStatusMessage(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleSaveForm = async () => {
    if (!sourcePdf) return;
    clearOutput();
    setErrorMessage(null);
    setIsSaving(true);
    setStatusMessage('Updating PDF form fields...');

    try {
      const result = await fillPdfFormFields(
        sourcePdf.bytes,
        formValues,
        { flatten: flattenOnSave },
        (msg) => setStatusMessage(msg),
      );
      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        url,
        filename: `${sanitizeBasePdfName(sourcePdf.file.name, 'toolmitra')}-filled.pdf`,
        size: blob.size,
        updatedCount: result.updatedCount,
        flattened: result.flattened,
      });
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update PDF form.');
      setStatusMessage(null);
    } finally {
      setIsSaving(false);
    }
  };

  const editableCount = sourcePdf
    ? sourcePdf.fields.filter((f) => !f.readOnly && f.kind !== 'unsupported').length
    : 0;

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
          id="pdf-forms-input"
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
            ? `Loaded: ${sourcePdf.file.name} (${sourcePdf.fields.length} form ${
                sourcePdf.fields.length === 1 ? 'field' : 'fields'
              })`
            : 'Drop an interactive AcroForm PDF here to fill fields and optionally flatten'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Single unencrypted PDF up to 50 MB · Text inputs, checkboxes, radio groups &amp; dropdowns
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isLoadingFile || isSaving}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isLoadingFile ? 'Scanning Form...' : sourcePdf ? 'Choose Different PDF' : 'Select PDF Form'}
          </button>
          {sourcePdf && (
            <button
              type="button"
              disabled={isLoadingFile || isSaving}
              onClick={() => {
                clearOutput();
                setSourcePdf(null);
                setFormValues({});
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
          <p>{statusMessage || 'Processing PDF form...'}</p>
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
                Filled PDF ready: {output.filename}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-800 dark:text-emerald-300">
                {output.updatedCount} field{output.updatedCount === 1 ? '' : 's'} updated ·{' '}
                {output.flattened ? 'Flattened (read-only)' : 'Remains editable'} ·{' '}
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
            <span>Download Filled PDF</span>
          </a>
        </div>
      )}

      {sourcePdf && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          {sourcePdf.fields.length === 0 ? (
            <div className="space-y-2 py-4 text-center">
              <ClipboardList
                className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No interactive AcroForm fields found in this PDF
              </p>
              <p className="mx-auto max-w-lg text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                This file appears to be a static/flat PDF without fillable AcroForm fields (or uses
                proprietary XFA forms). If you need to type answers onto a flat form, use{' '}
                <a href="/tools/edit-pdf" className="font-semibold text-blue-600 underline dark:text-blue-400">
                  Edit PDF
                </a>{' '}
                to place text overlays anywhere on the page.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Detected Form Fields ({sourcePdf.fields.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editableCount} editable field{editableCount === 1 ? '' : 's'} across{' '}
                    {sourcePdf.pageCount} {sourcePdf.pageCount === 1 ? 'page' : 'pages'}
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={flattenOnSave}
                    onChange={(e) => {
                      setFlattenOnSave(e.target.checked);
                      clearOutput();
                    }}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  <span>Flatten fields into static text on save</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sourcePdf.fields.map((field) => {
                  const val = formValues[field.name];
                  const inputId = `form-field-${field.name}`;

                  if (field.kind === 'checkbox') {
                    return (
                      <label
                        key={field.name}
                        htmlFor={inputId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 dark:border-slate-800"
                      >
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {field.name}
                          {field.readOnly && ' (Read-only)'}
                        </span>
                        <input
                          id={inputId}
                          type="checkbox"
                          disabled={field.readOnly}
                          checked={Boolean(val)}
                          onChange={(e) => {
                            setFormValues((prev) => ({ ...prev, [field.name]: e.target.checked }));
                            clearOutput();
                          }}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        />
                      </label>
                    );
                  }

                  if (field.kind === 'dropdown' || field.kind === 'optionlist' || field.kind === 'radio') {
                    return (
                      <div key={field.name}>
                        <label
                          htmlFor={inputId}
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          {field.name} ({field.kind}){field.readOnly && ' · Read-only'}
                        </label>
                        <select
                          id={inputId}
                          disabled={field.readOnly}
                          value={typeof val === 'string' ? val : ''}
                          onChange={(e) => {
                            setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }));
                            clearOutput();
                          }}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="">-- Select option --</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (field.kind === 'text') {
                    return (
                      <div key={field.name}>
                        <label
                          htmlFor={inputId}
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          {field.name}
                          {field.readOnly && ' · Read-only'}
                        </label>
                        <input
                          id={inputId}
                          type="text"
                          disabled={field.readOnly}
                          value={typeof val === 'string' ? val : ''}
                          onChange={(e) => {
                            setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }));
                            clearOutput();
                          }}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={field.name}
                      className="rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
                    >
                      {field.name} (Unsupported field type)
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isSaving || isLoadingFile || editableCount === 0}
                onClick={() => void handleSaveForm()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:w-auto dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isSaving ? 'Saving Form...' : 'Fill & Save PDF'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <p>
          Standard PDF AcroForm fields (text inputs, checkboxes, radio groups, and dropdown menus)
          are filled locally inside browser memory. Flattening turns form fields into static page
          content so recipients cannot alter values accidentally.
        </p>
      </div>
    </div>
  );
}
