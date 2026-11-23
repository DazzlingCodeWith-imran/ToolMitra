import { AlertCircle, AlertTriangle, Check, Copy, Download, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type QrMode = 'url' | 'text' | 'wifi' | 'email' | 'phone';
type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
type WifiEncryption = 'WPA' | 'WEP' | 'nopass';

function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const intVal = parseInt(match[1], 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 21;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function QrCodeGeneratorTool() {
  const [mode, setMode] = useState<QrMode>('url');
  const [urlValue, setUrlValue] = useState('https://example.com');
  const [textValue, setTextValue] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState<WifiEncryption>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [phoneValue, setPhoneValue] = useState('');

  const [size, setSize] = useState<number>(512);
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionLevel>('M');
  const [fgColor, setFgColor] = useState('#0F172A');
  const [bgColor, setBgColor] = useState('#FFFFFF');

  const [pngDataUrl, setPngDataUrl] = useState<string>('');
  const [svgString, setSvgString] = useState<string>('');
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const { payload, validationError } = useMemo(() => {
    if (mode === 'url') {
      const trimmed = urlValue.trim();
      if (!trimmed) {
        return { payload: '', validationError: 'Enter a website URL to generate a QR code.' };
      }
      if (trimmed.length > 2000) {
        return { payload: '', validationError: 'URL exceeds the 2,000 character limit.' };
      }
      return { payload: trimmed, validationError: null };
    }

    if (mode === 'text') {
      if (!textValue.trim()) {
        return { payload: '', validationError: 'Enter text to encode into a QR code.' };
      }
      if (textValue.length > 2000) {
        return { payload: '', validationError: 'Text exceeds the 2,000 character limit.' };
      }
      return { payload: textValue, validationError: null };
    }

    if (mode === 'wifi') {
      if (!wifiSsid.trim()) {
        return { payload: '', validationError: 'Enter a Wi-Fi network name (SSID).' };
      }
      const hiddenFlag = wifiHidden ? 'H:true;' : '';
      const passPart = wifiEncryption === 'nopass' ? '' : `P:${escapeWifiField(wifiPassword)};`;
      return {
        payload: `WIFI:T:${wifiEncryption};S:${escapeWifiField(wifiSsid.trim())};${passPart}${hiddenFlag};`,
        validationError: null,
      };
    }

    if (mode === 'email') {
      const trimmed = emailTo.trim();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { payload: '', validationError: 'Enter a valid recipient email address.' };
      }
      const params = new URLSearchParams();
      if (emailSubject.trim()) params.set('subject', emailSubject.trim());
      if (emailBody.trim()) params.set('body', emailBody.trim());
      const qs = params.toString();
      return {
        payload: `mailto:${trimmed}${qs ? `?${qs}` : ''}`,
        validationError: null,
      };
    }

    const cleanedPhone = phoneValue.trim();
    if (!cleanedPhone || !/^[+\d\s()-]{4,25}$/.test(cleanedPhone)) {
      return { payload: '', validationError: 'Enter a valid phone number.' };
    }
    return {
      payload: `tel:${cleanedPhone.replace(/\s+/g, '')}`,
      validationError: null,
    };
  }, [
    mode,
    urlValue,
    textValue,
    wifiSsid,
    wifiPassword,
    wifiEncryption,
    wifiHidden,
    emailTo,
    emailSubject,
    emailBody,
    phoneValue,
  ]);

  const contrastRatio = useMemo(() => getContrastRatio(fgColor, bgColor), [fgColor, bgColor]);
  const lowContrastWarning = contrastRatio < 3;

  useEffect(() => {
    let active = true;
    let createdBlobUrl = '';

    async function renderQr() {
      if (!payload || validationError) {
        setPngDataUrl('');
        setSvgString('');
        setSvgPreviewUrl('');
        setRenderError(null);
        return;
      }

      try {
        const QRCode = (await import('qrcode')).default;
        const [png, svg] = await Promise.all([
          QRCode.toDataURL(payload, {
            width: size,
            margin: 2,
            errorCorrectionLevel: errorCorrection,
            color: { dark: fgColor, light: bgColor },
          }),
          QRCode.toString(payload, {
            type: 'svg',
            margin: 2,
            errorCorrectionLevel: errorCorrection,
            color: { dark: fgColor, light: bgColor },
          }),
        ]);

        if (!active) return;
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        createdBlobUrl = URL.createObjectURL(blob);
        setPngDataUrl(png);
        setSvgString(svg);
        setSvgPreviewUrl(createdBlobUrl);
        setRenderError(null);
      } catch (err) {
        if (!active) return;
        setPngDataUrl('');
        setSvgString('');
        setSvgPreviewUrl('');
        setRenderError(
          err instanceof Error
            ? err.message
            : 'Content is too long for the selected error correction level.',
        );
      }
    }

    renderQr();

    return () => {
      active = false;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [payload, validationError, size, errorCorrection, fgColor, bgColor]);

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const link = document.createElement('a');
    link.href = pngDataUrl;
    link.download = `toolmitra-qr-${mode}.png`;
    link.click();
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `toolmitra-qr-${mode}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyPayload = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleReset = () => {
    setFgColor('#0F172A');
    setBgColor('#FFFFFF');
    setSize(512);
    setErrorCorrection('M');
  };

  const modeTabs: Array<{ id: QrMode; label: string }> = [
    { id: 'url', label: 'URL' },
    { id: 'text', label: 'Text' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Phone' },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Inputs & Customization */}
      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
        {/* Mode Tabs */}
        <div
          role="tablist"
          aria-label="QR code content type"
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
                onClick={() => setMode(tab.id)}
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

        {/* Dynamic Inputs */}
        {mode === 'url' && (
          <div>
            <label
              htmlFor="qr-url-input"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Website URL
            </label>
            <input
              id="qr-url-input"
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        )}

        {mode === 'text' && (
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="qr-text-input"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Plain Text
              </label>
              <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {textValue.length} / 2000
              </span>
            </div>
            <textarea
              id="qr-text-input"
              rows={4}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Enter any message, note, or code..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        )}

        {mode === 'wifi' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="qr-wifi-ssid"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Network Name (SSID)
                </label>
                <input
                  id="qr-wifi-ssid"
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="Office-WiFi"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="qr-wifi-sec"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Security
                </label>
                <select
                  id="qr-wifi-sec"
                  value={wifiEncryption}
                  onChange={(e) => setWifiEncryption(e.target.value as WifiEncryption)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="WPA">WPA / WPA2 / WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None (Open Network)</option>
                </select>
              </div>
            </div>

            {wifiEncryption !== 'nopass' && (
              <div>
                <label
                  htmlFor="qr-wifi-pass"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Password
                </label>
                <input
                  id="qr-wifi-pass"
                  type="text"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="Wi-Fi password"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={wifiHidden}
                onChange={(e) => setWifiHidden(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              <span>Hidden Wi-Fi network</span>
            </label>
          </div>
        )}

        {mode === 'email' && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="qr-email-to"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Recipient Email
              </label>
              <input
                id="qr-email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="hello@example.com"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="qr-email-subject"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Subject (Optional)
              </label>
              <input
                id="qr-email-subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Inquiry"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="qr-email-body"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Body (Optional)
              </label>
              <textarea
                id="qr-email-body"
                rows={2}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {mode === 'phone' && (
          <div>
            <label
              htmlFor="qr-phone-input"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              Phone Number
            </label>
            <input
              id="qr-phone-input"
              type="tel"
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              placeholder="+1 555 234 5678"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        )}

        {/* Style & Technical Options */}
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="qr-size"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                PNG Export Size
              </label>
              <select
                id="qr-size"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={256}>256 × 256 px</option>
                <option value={512}>512 × 512 px</option>
                <option value={1024}>1024 × 1024 px</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="qr-ecl"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Error Correction
              </label>
              <select
                id="qr-ecl"
                value={errorCorrection}
                onChange={(e) => setErrorCorrection(e.target.value as ErrorCorrectionLevel)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="L">L — Low (7% recovery)</option>
                <option value="M">M — Medium (15% recovery)</option>
                <option value="Q">Q — Quartile (25% recovery)</option>
                <option value="H">H — High (30% recovery)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="qr-fg-color"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Foreground Color
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="qr-fg-color"
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-700"
                />
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  {fgColor.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="qr-bg-color"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Background Color
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="qr-bg-color"
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-700"
                />
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  {bgColor.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {lowContrastWarning && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Low color contrast ({contrastRatio.toFixed(1)}:1). Phone cameras scan best when
                foreground and background have high contrast (e.g., dark ink on white).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Live Preview & Export */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Preview
            </h2>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset style</span>
            </button>
          </div>

          <div className="mt-5 flex min-h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
            {validationError || renderError ? (
              <div className="flex max-w-xs flex-col items-center text-center">
                <AlertCircle className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {validationError || renderError}
                </p>
              </div>
            ) : svgPreviewUrl ? (
              <img
                src={svgPreviewUrl}
                alt="Generated QR code preview"
                className="h-56 w-56 rounded-lg object-contain shadow-xs"
              />
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={!pngDataUrl}
              onClick={handleDownloadPng}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>PNG</span>
            </button>
            <button
              type="button"
              disabled={!svgString}
              onClick={handleDownloadSvg}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>SVG</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!payload || Boolean(validationError)}
            onClick={handleCopyPayload}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {copiedPayload ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Encoded text copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy encoded data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
