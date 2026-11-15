import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { Article } from '@/types/article';

/**
 * Opens an article source URL in an in-app browser sheet on native platforms,
 * or via the default browser/tab on web.
 */
export async function openArticleUrl(url: string): Promise<void> {
  if (!url) return;
  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: '#0D9488',
    toolbarColor: '#FAF9F6',
    enableBarCollapsing: true,
    showTitle: true,
  });
}

/**
 * Formats a YYYY-MM-DD date string into a readable editorial date without
 * timezone-induced off-by-one-day shifts.
 */
export function formatEditionDate(
  dateStr: string,
  style: 'full' | 'short' = 'full'
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (style === 'short') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns a concise source label from `source_names` or the URL hostname.
 */
export function getSourceLabel(article: Article): string | null {
  if (article.source_names && article.source_names.length > 0) {
    return article.source_names[0];
  }
  try {
    const hostname = new URL(article.original_url).hostname.replace(/^www\./, '');
    return hostname || null;
  } catch {
    return null;
  }
}

export interface SummaryPointSegment {
  text: string;
  isAnchor: boolean;
}

/**
 * Splits a dense summary paragraph into punchy scannable points.
 */
export function splitSummaryIntoPoints(summary: string): string[] {
  if (!summary) return [];
  const trimmed = summary.trim();
  if (!trimmed) return [];

  const abbreviations = new Set([
    'mr.',
    'mrs.',
    'ms.',
    'dr.',
    'prof.',
    'sr.',
    'jr.',
    'st.',
    'vs.',
    'etc.',
    'u.s.',
    'u.k.',
    'e.u.',
    'jan.',
    'feb.',
    'mar.',
    'apr.',
    'jun.',
    'jul.',
    'aug.',
    'sep.',
    'sept.',
    'oct.',
    'nov.',
    'dec.',
    'inc.',
    'ltd.',
    'co.',
    'corp.',
  ]);

  const rawPoints = trimmed
    .split(/\n+/)
    .flatMap((line) => {
      const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
      if (!cleaned) return [];
      const tokens = cleaned.split(/\s+/);
      const sentences: string[] = [];
      let current: string[] = [];

      for (const token of tokens) {
        current.push(token);
        const lower = token.toLowerCase();
        const endsSentence = /[.!?]["'”’)]*$/.test(token);
        const isInitial = /^[A-Z]\.$/.test(token);
        if (endsSentence && !abbreviations.has(lower) && !isInitial) {
          sentences.push(current.join(' '));
          current = [];
        }
      }
      if (current.length > 0) {
        sentences.push(current.join(' '));
      }
      return sentences;
    })
    .map((s) => s.trim())
    .filter(Boolean);

  return rawPoints.length > 0 ? rawPoints : [trimmed];
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'while',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'against',
  'between',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'can',
  'will',
  'just',
  'should',
  'now',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'they',
  'them',
  'their',
  'he',
  'him',
  'his',
  'she',
  'her',
  'hers',
  'we',
  'us',
  'our',
  'you',
  'your',
  'who',
  'whom',
  'which',
  'what',
  'says',
  'said',
  'also',
  'could',
  'would',
  'may',
  'might',
]);

/**
 * Parses a single sentence/point into segments with anchor words highlighted
 * (lead-in phrase, numbers/metrics, and capitalized named entities) for ADHD-friendly scanning.
 */
export function parseAnchorSegments(point: string): SummaryPointSegment[] {
  const words = point.trim().split(/\s+/);
  if (words.length === 0) return [];

  // Lead-in anchor: highlight the first 2-3 words up to a comma/colon or first 2 words
  let leadCount = Math.min(2, words.length);
  for (let i = 0; i < Math.min(4, words.length); i++) {
    if (/[,:;—–-]$/.test(words[i])) {
      leadCount = i + 1;
      break;
    }
  }

  const isWordAnchor = (word: string, index: number): boolean => {
    if (index < leadCount) return true;
    const clean = word.replace(/^[^a-zA-Z0-9$%]+|[^a-zA-Z0-9$%]+$/g, '');
    if (!clean) return false;
    const lower = clean.toLowerCase();
    if (STOP_WORDS.has(lower)) return false;

    // Numbers, percentages, currencies, years, measurements
    if (/\d/.test(clean)) return true;

    // Capitalized proper nouns / acronyms mid-sentence
    if (index > 0 && /^[A-Z][a-zA-Z0-9-]{1,}$/.test(clean)) {
      return true;
    }

    return false;
  };

  const segments: SummaryPointSegment[] = [];
  for (let i = 0; i < words.length; i++) {
    const anchor = isWordAnchor(words[i], i);
    const tokenWithSpace = i < words.length - 1 ? `${words[i]} ` : words[i];
    const prev = segments[segments.length - 1];
    if (prev && prev.isAnchor === anchor) {
      prev.text += tokenWithSpace;
    } else {
      segments.push({ text: tokenWithSpace, isAnchor: anchor });
    }
  }

  return segments;
}


