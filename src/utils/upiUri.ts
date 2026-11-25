export interface UpiInput {
  upiId: string;
  payeeName: string;
  amount: string;
  note: string;
}

export interface UpiFieldErrors {
  upiId?: string;
  payeeName?: string;
  amount?: string;
  note?: string;
}

export interface UpiBuildResult {
  valid: boolean;
  uri: string;
  error: string | null;
  fieldErrors: UpiFieldErrors;
}

const UPI_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}@[a-zA-Z0-9][a-zA-Z0-9.-]{1,63}$/;
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

export function buildUpiPaymentUri(input: UpiInput): UpiBuildResult {
  const cleanUpiId = input.upiId.trim();
  const cleanPayeeName = input.payeeName.trim();
  const cleanAmountRaw = input.amount.trim();
  const cleanNote = input.note.trim();

  const fieldErrors: UpiFieldErrors = {};

  if (!cleanUpiId) {
    fieldErrors.upiId = 'Enter your UPI ID (example: username@upi).';
  } else if (/\.\./.test(cleanUpiId) || !UPI_ID_REGEX.test(cleanUpiId) || cleanUpiId.endsWith('.')) {
    fieldErrors.upiId = 'Enter a valid UPI ID such as username@upi or merchant@okaxis.';
  }

  if (!cleanPayeeName) {
    fieldErrors.payeeName = 'Enter the payee or receiver name.';
  } else if (cleanPayeeName.length < 2 || cleanPayeeName.length > 80) {
    fieldErrors.payeeName = 'Payee name must be between 2 and 80 characters.';
  }

  let normalizedAmount = '';
  if (cleanAmountRaw) {
    if (!AMOUNT_REGEX.test(cleanAmountRaw)) {
      fieldErrors.amount = 'Enter a valid amount in INR with up to 2 decimal places (e.g., 250 or 499.50).';
    } else {
      const numeric = Number(cleanAmountRaw);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        fieldErrors.amount = 'Amount must be greater than 0, or leave blank for an open amount.';
      } else if (numeric > 1000000) {
        fieldErrors.amount = 'Amount cannot exceed 10,00,000 INR.';
      } else {
        normalizedAmount = cleanAmountRaw.includes('.')
          ? numeric.toFixed(cleanAmountRaw.split('.')[1].length)
          : String(Math.trunc(numeric));
      }
    }
  }

  if (cleanNote.length > 80) {
    fieldErrors.note = 'Payment note must be 80 characters or fewer.';
  }

  const firstError =
    fieldErrors.upiId || fieldErrors.payeeName || fieldErrors.amount || fieldErrors.note || null;

  if (firstError) {
    return {
      valid: false,
      uri: '',
      error: firstError,
      fieldErrors,
    };
  }

  const parts = [
    `pa=${encodeURIComponent(cleanUpiId)}`,
    `pn=${encodeURIComponent(cleanPayeeName)}`,
    'cu=INR',
  ];

  if (normalizedAmount) {
    parts.push(`am=${encodeURIComponent(normalizedAmount)}`);
  }
  if (cleanNote) {
    parts.push(`tn=${encodeURIComponent(cleanNote)}`);
  }

  return {
    valid: true,
    uri: `upi://pay?${parts.join('&')}`,
    error: null,
    fieldErrors: {},
  };
}
