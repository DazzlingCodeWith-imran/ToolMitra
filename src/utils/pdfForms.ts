import { hasPdfSignature } from '@/src/utils/pdfMerge';

export const MAX_FORMS_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type FormFieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'unsupported';

export interface InspectedFormField {
  name: string;
  kind: FormFieldKind;
  value: string | boolean;
  options: string[];
  readOnly: boolean;
}

export async function inspectPdfFormFields(sourceBytes: Uint8Array): Promise<{
  pageCount: number;
  fields: InspectedFormField[];
}> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFRadioGroup,
    PDFDropdown,
    PDFOptionList,
  } = await import('pdf-lib');

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypted') || msg.includes('password')) {
      throw new Error('This PDF is password-protected or encrypted. Unlock it before filling forms.');
    }
    throw new Error('Could not read PDF structure. Please check that the file is not corrupted.');
  }

  const form = pdfDoc.getForm();
  const rawFields = form.getFields();
  const inspected: InspectedFormField[] = [];

  for (const field of rawFields) {
    const name = field.getName();
    const readOnly = field.isReadOnly();

    if (field instanceof PDFTextField) {
      inspected.push({
        name,
        kind: 'text',
        value: field.getText() ?? '',
        options: [],
        readOnly,
      });
    } else if (field instanceof PDFCheckBox) {
      inspected.push({
        name,
        kind: 'checkbox',
        value: field.isChecked(),
        options: [],
        readOnly,
      });
    } else if (field instanceof PDFRadioGroup) {
      inspected.push({
        name,
        kind: 'radio',
        value: field.getSelected() ?? '',
        options: field.getOptions(),
        readOnly,
      });
    } else if (field instanceof PDFDropdown) {
      const selected = field.getSelected();
      inspected.push({
        name,
        kind: 'dropdown',
        value: selected[0] ?? '',
        options: field.getOptions(),
        readOnly,
      });
    } else if (field instanceof PDFOptionList) {
      const selected = field.getSelected();
      inspected.push({
        name,
        kind: 'optionlist',
        value: selected[0] ?? '',
        options: field.getOptions(),
        readOnly,
      });
    } else {
      inspected.push({
        name,
        kind: 'unsupported',
        value: '',
        options: [],
        readOnly: true,
      });
    }
  }

  return {
    pageCount: pdfDoc.getPageCount(),
    fields: inspected,
  };
}

export async function fillPdfFormFields(
  sourceBytes: Uint8Array,
  values: Record<string, string | boolean>,
  options: { flatten: boolean },
  onProgress?: (message: string) => void,
): Promise<{ bytes: Uint8Array; updatedCount: number; flattened: boolean }> {
  if (sourceBytes.byteLength === 0 || !hasPdfSignature(sourceBytes)) {
    throw new Error('Selected file is not a valid PDF document.');
  }

  onProgress?.('Loading PDF form engine...');
  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFRadioGroup,
    PDFDropdown,
    PDFOptionList,
  } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  let updatedCount = 0;

  for (const field of fields) {
    if (field.isReadOnly()) continue;
    const name = field.getName();
    if (!(name in values)) continue;
    const nextVal = values[name];

    if (field instanceof PDFTextField && typeof nextVal === 'string') {
      field.setText(nextVal);
      updatedCount++;
    } else if (field instanceof PDFCheckBox && typeof nextVal === 'boolean') {
      if (nextVal) field.check();
      else field.uncheck();
      updatedCount++;
    } else if (field instanceof PDFRadioGroup && typeof nextVal === 'string' && nextVal) {
      field.select(nextVal);
      updatedCount++;
    } else if (field instanceof PDFDropdown && typeof nextVal === 'string' && nextVal) {
      field.select(nextVal);
      updatedCount++;
    } else if (field instanceof PDFOptionList && typeof nextVal === 'string' && nextVal) {
      field.select(nextVal);
      updatedCount++;
    }
  }

  if (options.flatten) {
    onProgress?.('Flattening form fields...');
    form.flatten();
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    updatedCount,
    flattened: options.flatten,
  };
}
