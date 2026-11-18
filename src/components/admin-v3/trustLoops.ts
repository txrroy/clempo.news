import { DEFAULT_FLAG_AUTONOMY } from '@/hooks/useGovernance';
import { getFlagShortLabel } from '@/lib/editorialLabels';
import type { Article, ArticleFlag, AutonomyLevel } from '@/types/article';

export interface FlagTrustStat {
  flag: ArticleFlag;
  label: string;
  accepted: number;
  total: number;
  rate: number | null;
  currentLevel: AutonomyLevel;
}

export interface TrustLoopSuggestion {
  flag: ArticleFlag;
  kind: 'promote' | 'downgrade';
  targetLevel: AutonomyLevel;
  message: string;
  actionLabel: string;
}

const ALL_FLAGS: ArticleFlag[] = [
  'TOO_COMPLEX',
  'LOADED_LANGUAGE',
  'GRAPHIC_DETAIL',
  'ONE_SIDED',
  'SNIPPET_ONLY',
];

const PROMOTE_ELIGIBLE_FLAGS = new Set<ArticleFlag>([
  'TOO_COMPLEX',
  'LOADED_LANGUAGE',
  'ONE_SIDED',
]);

const MIN_PROMOTE_SAMPLES = 15;
const MIN_PROMOTE_RATE = 90;
const MIN_DOWNGRADE_SAMPLES = 10;
const MAX_DOWNGRADE_RATE = 80;

function extractFlagsForArticle(article: Article): Set<ArticleFlag> {
  const found = new Set<ArticleFlag>(article.flags ?? []);
  if (article.auto_retried_complexity) {
    found.add('TOO_COMPLEX');
  }
  for (const entry of article.retry_history ?? []) {
    const trig = entry.trigger.toUpperCase();
    for (const f of ALL_FLAGS) {
      if (trig.includes(f) || trig.includes(f.replace('_', ' '))) {
        found.add(f);
      }
    }
  }
  return found;
}

function wasAcceptedUnedited(article: Article): boolean {
  if (article.status !== 'published') return false;
  if (article.edited_at) return false;
  const intervened = (article.decision_history ?? []).some(
    (h) =>
      h.action === 'edited' ||
      h.action === 'unpublished' ||
      h.action === 'rejected'
  );
  return !intervened;
}

export function computeTrustLoopStats(
  articles: Article[],
  flagAutonomy?: Partial<Record<ArticleFlag, AutonomyLevel>>
): {
  stats: FlagTrustStat[];
  suggestions: TrustLoopSuggestion[];
} {
  const autonomyMap = { ...DEFAULT_FLAG_AUTONOMY, ...(flagAutonomy || {}) };
  const counts = new Map<ArticleFlag, { accepted: number; total: number }>();
  for (const f of ALL_FLAGS) {
    counts.set(f, { accepted: 0, total: 0 });
  }

  for (const article of articles) {
    if (article.status !== 'published' && article.status !== 'rejected') {
      continue;
    }
    const flags = extractFlagsForArticle(article);
    const clean = wasAcceptedUnedited(article);
    for (const f of flags) {
      const entry = counts.get(f);
      if (!entry) continue;
      entry.total += 1;
      if (clean) entry.accepted += 1;
    }
  }

  const stats: FlagTrustStat[] = [];
  const suggestions: TrustLoopSuggestion[] = [];

  for (const flag of ALL_FLAGS) {
    const { accepted, total } = counts.get(flag) ?? { accepted: 0, total: 0 };
    const rate = total > 0 ? Math.round((accepted / total) * 100) : null;
    const currentLevel = autonomyMap[flag] ?? 'ask_me';
    const label = getFlagShortLabel(flag);

    stats.push({ flag, label, accepted, total, rate, currentLevel });

    if (
      PROMOTE_ELIGIBLE_FLAGS.has(flag) &&
      total >= MIN_PROMOTE_SAMPLES &&
      rate !== null &&
      rate >= MIN_PROMOTE_RATE
    ) {
      if (currentLevel === 'ask_me') {
        suggestions.push({
          flag,
          kind: 'promote',
          targetLevel: 'fix_then_show',
          message: `${accepted} of ${total} stories (${rate}%) published with no edits. Let the agent draft fixes first?`,
          actionLabel: 'Move to Fix & show',
        });
      } else if (currentLevel === 'fix_then_show') {
        suggestions.push({
          flag,
          kind: 'promote',
          targetLevel: 'fix_automatically',
          message: `${accepted} of ${total} stories (${rate}%) published with no edits. Auto-fix without asking first?`,
          actionLabel: 'Move to Auto-fix',
        });
      }
    } else if (
      currentLevel === 'fix_automatically' &&
      total >= MIN_DOWNGRADE_SAMPLES &&
      rate !== null &&
      rate < MAX_DOWNGRADE_RATE
    ) {
      const intervened = total - accepted;
      const intervenedRate = 100 - rate;
      suggestions.push({
        flag,
        kind: 'downgrade',
        targetLevel: 'fix_then_show',
        message: `${intervened} of ${total} stories (${intervenedRate}%) were edited or rejected. Move back to Fix & show?`,
        actionLabel: 'Move back to Fix & show',
      });
    }
  }

  return { stats, suggestions };
}

