import { Platform, type TextStyle } from 'react-native';
import type { Article, ArticleFlag } from '@/types/article';

export const V2_COLORS = {
  ink: '#16181d',
  muted: '#5b616e',
  line: '#e4e6ea',
  lineStrong: '#c9cdd4',
  ground: '#ffffff',
  statusReady: '#1a6b3c',
  statusCheck: '#8a5a00',
  statusUnverified: '#b3261e',
} as const;

export const V2_FONT = Platform.select({
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'Inter',
});

export const V2_TYPE: Record<
  'pageTitle' | 'sectionTitle' | 'itemHeadline' | 'body' | 'meta',
  TextStyle
> = {
  pageTitle: {
    fontFamily: V2_FONT,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    color: V2_COLORS.ink,
  },
  sectionTitle: {
    fontFamily: V2_FONT,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: V2_COLORS.ink,
  },
  itemHeadline: {
    fontFamily: V2_FONT,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: V2_COLORS.ink,
  },
  body: {
    fontFamily: V2_FONT,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20.3,
    color: V2_COLORS.ink,
  },
  meta: {
    fontFamily: V2_FONT,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: V2_COLORS.muted,
  },
};

export const V2_SPACE = {
  pageMaxWidth: 1120,
  pageSidePadding: 32,
  sectionGap: 48,
  listRowPadY: 16,
  tableRowPadY: 12,
  gapSm: 8,
  gapMd: 12,
  gapLg: 24,
} as const;

export const V2_SHAPE = {
  controlRadius: 6,
  otherRadius: 0,
  buttonHeight: 44,
} as const;

export type ReviewVerdict = 'ready' | 'check' | 'unverified';

export function getArticleVerdict(article: Article): ReviewVerdict {
  const flags = article.flags ?? [];
  const score = article.confidence_score ?? 0;
  if (article.judge_pass === false || score < 60) {
    return 'unverified';
  }
  if (flags.length > 0 || score < 80 || article.used_fallback_snippet) {
    return 'check';
  }
  return 'ready';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Formats a date/timestamp in 24-hour UTC format: "Sun 15 Nov 2026, 07:24 UTC".
 */
export function formatUtcTimestamp(input?: string | Date | null): string {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    return 'Unknown UTC';
  }
  const dayName = WEEKDAYS[date.getUTCDay()];
  const dayNum = date.getUTCDate();
  const monthName = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${dayName} ${dayNum} ${monthName} ${year}, ${hh}:${mm} UTC`;
}

/**
 * Formats a YYYY-MM-DD date string or ISO string as "15 Nov 2026".
 */
export function formatUtcDateOnly(input?: string | null): string {
  if (!input) return 'Unknown date';
  const normalized = input.length === 10 ? `${input}T00:00:00Z` : input;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return input;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const FLAG_PLAIN_LABELS: Record<ArticleFlag, string> = {
  GRAPHIC_DETAIL: 'May contain sensitive or graphic detail',
  SNIPPET_ONLY: 'Drafted from a short feed snippet only',
  ONE_SIDED: 'Covers only one perspective',
  LOADED_LANGUAGE: 'Contains loaded or emotional phrasing',
  TOO_COMPLEX: 'Reading level may be too high',
};

export function formatArticleFlagsPlain(flags?: ArticleFlag[]): string {
  if (!flags || flags.length === 0) return 'None';
  return flags.map((f) => FLAG_PLAIN_LABELS[f] ?? 'Needs review').join('; ');
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

/**
 * Formats the 1-line issue summary: scores below 100, then one issue of 20 words or fewer.
 * Never exposes internal flag names or scoring terms.
 */
export function formatArticleIssueLine(article: Article): string {
  const scoreParts: string[] = [];
  if (article.scores) {
    const entries: [string, number][] = [
      ['Accuracy', article.scores.accuracy],
      ['Neutrality', article.scores.neutrality],
      ['Safety', article.scores.safety],
      ['Readability', article.scores.readability],
    ];
    for (const [label, val] of entries) {
      if (typeof val === 'number' && val < 100) {
        scoreParts.push(`${label} ${Math.round(val)}`);
      }
    }
  } else if (typeof article.confidence_score === 'number' && article.confidence_score < 100) {
    scoreParts.push(`${Math.round(article.confidence_score)}/100`);
  }

  let issue = '';
  const firstFlag = article.flags?.[0];
  if (firstFlag && FLAG_PLAIN_LABELS[firstFlag]) {
    issue = FLAG_PLAIN_LABELS[firstFlag];
  } else if (article.used_fallback_snippet) {
    issue = FLAG_PLAIN_LABELS.SNIPPET_ONLY;
  } else if (article.confidence_reasoning?.trim()) {
    issue = truncateWords(article.confidence_reasoning, 20);
  } else {
    issue = 'All checks passed';
  }

  if (scoreParts.length > 0) {
    return `${scoreParts.join(', ')} — ${issue}.`;
  }
  return `${issue}.`;
}

/**
 * Formats story age relative to the edition date ("today", "1 day old", "3 days old").
 */
export function formatStoryAge(articleDate: string, referenceDate: string): string {
  const a = new Date(`${articleDate}T00:00:00Z`).getTime();
  const b = new Date(`${referenceDate}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return formatUtcDateOnly(articleDate);
  const diffDays = Math.max(0, Math.round((b - a) / 86_400_000));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day old';
  return `${diffDays} days old`;
}

/**
 * Sorts articles by lowest score first, then oldest date first.
 */
export function sortByLowestScoreThenOldest(a: Article, b: Article): number {
  const scoreDiff = (a.confidence_score ?? 0) - (b.confidence_score ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  return a.date.localeCompare(b.date);
}
