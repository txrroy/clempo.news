import { DEFAULT_FLAG_AUTONOMY } from '@/hooks/useGovernance';
import { getFlagShortLabel } from '@/lib/editorialLabels';
import type { ArticleFlag, AutonomyLevel, PolicySettings } from '@/types/article';

interface PolicyComparable {
  settings: PolicySettings;
  admin_instructions: string;
}

const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  ask_me: 'Ask editor',
  fix_then_show: 'Fix & show',
  fix_automatically: 'Auto-fix',
};

const TONE_LABELS: Record<PolicySettings['tone'], string> = {
  calm_neutral: 'Calm Neutral',
  curious_educator: 'Curious Educator',
  concise_wire: 'Concise Wire',
};

const ALL_FLAGS: ArticleFlag[] = [
  'TOO_COMPLEX',
  'LOADED_LANGUAGE',
  'GRAPHIC_DETAIL',
  'ONE_SIDED',
  'SNIPPET_ONLY',
];

/**
 * Computes human-readable field diffs between two policy snapshots.
 */
export function diffPolicyVersions(
  prev: PolicyComparable,
  next: PolicyComparable
): string[] {
  const diffs: string[] = [];
  const a = prev.settings;
  const b = next.settings;

  if (a.reading_level !== b.reading_level) {
    diffs.push(`Reading level: ${a.reading_level} -> ${b.reading_level}`);
  }
  if (a.tone !== b.tone) {
    diffs.push(
      `Tone: ${TONE_LABELS[a.tone] ?? a.tone} -> ${TONE_LABELS[b.tone] ?? b.tone}`
    );
  }
  if (a.target_headline_words !== b.target_headline_words) {
    diffs.push(
      `Headline target: ${a.target_headline_words}w -> ${b.target_headline_words}w`
    );
  }
  if (a.target_summary_words !== b.target_summary_words) {
    diffs.push(
      `Summary target: ${a.target_summary_words}w -> ${b.target_summary_words}w`
    );
  }
  if (a.max_per_topic !== b.max_per_topic) {
    diffs.push(`Max/topic: ${a.max_per_topic} -> ${b.max_per_topic}`);
  }
  if (a.max_per_region !== b.max_per_region) {
    diffs.push(`Max/region: ${a.max_per_region} -> ${b.max_per_region}`);
  }
  if (a.max_market_stories !== b.max_market_stories) {
    diffs.push(`Max Markets: ${a.max_market_stories} -> ${b.max_market_stories}`);
  }
  if (Boolean(a.auto_publish_ready) !== Boolean(b.auto_publish_ready)) {
    diffs.push(
      `Auto-publish Ready: ${a.auto_publish_ready ? 'On' : 'Off'} -> ${b.auto_publish_ready ? 'On' : 'Off'}`
    );
  }

  const prevAutonomy = { ...DEFAULT_FLAG_AUTONOMY, ...(a.flag_autonomy || {}) };
  const nextAutonomy = { ...DEFAULT_FLAG_AUTONOMY, ...(b.flag_autonomy || {}) };
  for (const flag of ALL_FLAGS) {
    if (prevAutonomy[flag] !== nextAutonomy[flag]) {
      diffs.push(
        `${getFlagShortLabel(flag)}: ${AUTONOMY_LABELS[prevAutonomy[flag]]} -> ${AUTONOMY_LABELS[nextAutonomy[flag]]}`
      );
    }
  }

  const prevInst = (prev.admin_instructions || '').trim();
  const nextInst = (next.admin_instructions || '').trim();
  if (prevInst !== nextInst) {
    if (!prevInst && nextInst) diffs.push('Custom instructions added');
    else if (prevInst && !nextInst) diffs.push('Custom instructions cleared');
    else diffs.push('Custom instructions updated');
  }

  return diffs;
}

