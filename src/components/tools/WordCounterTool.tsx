import { AlertCircle, Check, Copy, FileUp, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { analyzeText, normalizeWhitespace, toTitleCase } from '@/src/utils/wordCounter';

const SAMPLE_TEXT = `ToolMitra helps people handle everyday digital tasks directly in the browser. Whether you are tightening up an article draft, checking character limits for a meta description, or preparing notes for a presentation, fast feedback keeps writing effortless.

Clear prose respects your reader's time. Short sentences, accurate metrics, and distraction-free tools make routine editing faster across desktop and mobile devices.`;

const MAX_TXT_BYTES = 2 * 1024 * 1024;

export function WordCounterTool() {
  const [text, setText] = useState('');
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const analysis = useMemo(
    () => analyzeText(text, excludeStopWords),
    [text, excludeStopWords],
  );

  const handleImportTxt = async (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
      setErrorMessage('Please select a plain text (.txt) file.');
      return;
    }
    if (file.size > MAX_TXT_BYTES) {
      setErrorMessage('File exceeds the 2 MB plain-text limit.');
      return;
    }

    try {
      const content = await file.text();
      setText(content);
    } catch {
      setErrorMessage('Could not read the selected text file.');
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Clipboard access was denied by your browser.');
    }
  };

  const metrics = [
    { label: 'Words', value: analysis.words.toLocaleString() },
    { label: 'Characters', value: analysis.charactersWithSpaces.toLocaleString() },
    { label: 'No Spaces', value: analysis.charactersWithoutSpaces.toLocaleString() },
    { label: 'Sentences', value: analysis.sentences.toLocaleString() },
    { label: 'Paragraphs', value: analysis.paragraphs.toLocaleString() },
    { label: 'Reading Time', value: analysis.readingTimeLabel },
  ];

  return (
    <div className="space-y-6">
      {/* Live Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Editor Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleImportTxt}
              className="sr-only"
              id="word-counter-txt-import"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Import .txt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setText(SAMPLE_TEXT);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Load Sample</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!text}
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!text}
              onClick={() => {
                setText('');
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        <label htmlFor="word-counter-textarea" className="sr-only">
          Text to count and analyze
        </label>
        <textarea
          id="word-counter-textarea"
          rows={11}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your text here to count words, characters, sentences, paragraphs, and reading time..."
          className="w-full rounded-lg border border-slate-300 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-2 focus:outline-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-950"
        />

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 text-xs text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Text Transform Utilities */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Quick cleanup:
            </span>
            <button
              type="button"
              disabled={!text}
              onClick={() => setText((prev) => prev.toUpperCase())}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              UPPERCASE
            </button>
            <button
              type="button"
              disabled={!text}
              onClick={() => setText((prev) => prev.toLowerCase())}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              lowercase
            </button>
            <button
              type="button"
              disabled={!text}
              onClick={() => setText((prev) => toTitleCase(prev))}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Title Case
            </button>
            <button
              type="button"
              disabled={!text}
              onClick={() => setText((prev) => normalizeWhitespace(prev))}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clean Extra Spaces
            </button>
          </div>

          <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            Speaking time: {analysis.speakingTimeLabel}
          </p>
        </div>
      </div>

      {/* Top Keywords Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Top Keywords
          </h2>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={excludeStopWords}
              onChange={(e) => setExcludeStopWords(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <span>Exclude common stop words</span>
          </label>
        </div>

        {analysis.topKeywords.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2 font-medium">Keyword</th>
                  <th className="py-2 text-right font-medium">Count</th>
                  <th className="py-2 text-right font-medium">Density</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {analysis.topKeywords.map((entry) => (
                  <tr key={entry.word}>
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-200">
                      {entry.word}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {entry.count}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {entry.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Enter text above to inspect keyword frequency and density.
          </p>
        )}
      </div>
    </div>
  );
}
