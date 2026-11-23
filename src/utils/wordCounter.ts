export interface KeywordEntry {
  word: string;
  count: number;
  percentage: number;
}

export interface TextAnalysis {
  words: number;
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTimeLabel: string;
  speakingTimeLabel: string;
  topKeywords: KeywordEntry[];
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'you', 'your', 'our', 'can', 'will',
  'into', 'about', 'more', 'than', 'when', 'what', 'which', 'who', 'all',
  'any', 'use', 'using', 'used', 'how', 'why', 'its', 'they', 'their', 'them',
  'she', 'his', 'her', 'out', 'also', 'just', 'one', 'two', 'been', 'being',
]);

function formatDuration(words: number, wpm: number): string {
  if (words === 0) return '0 sec';
  const totalSeconds = Math.max(1, Math.round((words / wpm) * 60));
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
}

export function analyzeText(input: string, excludeStopWords = true): TextAnalysis {
  const charactersWithSpaces = input.length;
  const charactersWithoutSpaces = input.replace(/\s/g, '').length;

  const trimmed = input.trim();
  const wordTokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const words = wordTokens.length;

  const sentences = trimmed
    ? trimmed
        .split(/[.!?]+(?=\s|$)/)
        .map((s) => s.trim())
        .filter(Boolean).length
    : 0;

  const paragraphs = trimmed
    ? trimmed
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean).length
    : 0;

  const frequency = new Map<string, number>();
  let totalNormalizedWords = 0;

  for (const raw of wordTokens) {
    const cleaned = raw.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!cleaned || cleaned.length < 2) continue;
    totalNormalizedWords += 1;
    if (excludeStopWords && STOP_WORDS.has(cleaned)) continue;
    frequency.set(cleaned, (frequency.get(cleaned) ?? 0) + 1);
  }

  const topKeywords = Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word, count]) => ({
      word,
      count,
      percentage: totalNormalizedWords > 0 ? (count / totalNormalizedWords) * 100 : 0,
    }));

  return {
    words,
    charactersWithSpaces,
    charactersWithoutSpaces,
    sentences,
    paragraphs,
    readingTimeLabel: formatDuration(words, 225),
    speakingTimeLabel: formatDuration(words, 130),
    topKeywords,
  };
}

export function toTitleCase(input: string): string {
  return input.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

export function normalizeWhitespace(input: string): string {
  return input
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
