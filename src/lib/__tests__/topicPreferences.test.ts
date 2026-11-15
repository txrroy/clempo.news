import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTopicPreferences,
  createEmptyTopicPreferences,
  getArticleTags,
  getTopicRecord,
  getTopicSignalExplanation,
  getTopicSignalStatus,
  muteTopicForever,
  resetTopicPreference,
  voteOnArticlePreference,
// @ts-expect-error Node 24 native TS runner requires .ts extension
} from '../topicPreferences.ts';
import type { Article } from '../../types/article';

function makeArticle(
  id: string,
  topic?: string,
  extra?: Partial<Pick<Article, 'region' | 'tags'>>
): Article {
  return {
    id,
    date: '2026-11-14',
    topic,
    ...extra,
    original_url: `https://example.com/${id}`,
    image_url: null,
    ai_headline: `Headline ${id}`,
    ai_summary: `Summary ${id}`,
    confidence_score: 95,
    confidence_reasoning: 'Grounded.',
    status: 'published',
    approved_by: null,
  };
}

test('signal status transitions between normal, boosted, reduced, and off', () => {
  let state = createEmptyTopicPreferences();
  assert.equal(getTopicSignalStatus(getTopicRecord(state, 'Society')), 'normal');

  state = voteOnArticlePreference(state, 's1', 'Society', 'dislike');
  assert.equal(getTopicSignalStatus(getTopicRecord(state, 'Society')), 'normal');

  state = voteOnArticlePreference(state, 's2', 'Society', 'dislike');
  assert.equal(getTopicSignalStatus(getTopicRecord(state, 'Society')), 'reduced');
  assert.equal(
    getTopicSignalExplanation('Society', getTopicRecord(state, 'Society')).headline,
    'You are seeing less of Society'
  );

  let scienceState = createEmptyTopicPreferences();
  scienceState = voteOnArticlePreference(scienceState, 'sc1', 'Science', 'like');
  scienceState = voteOnArticlePreference(scienceState, 'sc2', 'Science', 'like');
  assert.equal(getTopicSignalStatus(getTopicRecord(scienceState, 'Science')), 'boosted');
  assert.equal(
    getTopicSignalExplanation('Science', getTopicRecord(scienceState, 'Science')).headline,
    'You are seeing more of Science'
  );
});

test('toggling or switching votes updates topic counts accurately', () => {
  let state = createEmptyTopicPreferences();
  state = voteOnArticlePreference(state, 'a1', 'Science', 'like');
  assert.equal(getTopicRecord(state, 'Science').likes, 1);
  assert.equal(getTopicRecord(state, 'Science').dislikes, 0);

  state = voteOnArticlePreference(state, 'a1', 'Science', 'like');
  assert.equal(getTopicRecord(state, 'Science').likes, 0);
  assert.equal(state.articleVotes.a1, undefined);

  state = voteOnArticlePreference(state, 'a1', 'Science', 'dislike');
  assert.equal(getTopicRecord(state, 'Science').dislikes, 1);
  state = voteOnArticlePreference(state, 'a1', 'Science', 'like');
  assert.equal(getTopicRecord(state, 'Science').dislikes, 0);
  assert.equal(getTopicRecord(state, 'Science').likes, 1);
});

test('muteTopicForever sets status to off and resetTopicPreference restores normal', () => {
  let state = createEmptyTopicPreferences();
  state = voteOnArticlePreference(state, 'c1', 'Conflict', 'dislike');
  state = voteOnArticlePreference(state, 'c2', 'Conflict', 'dislike');
  state = muteTopicForever(state, 'Conflict');

  const mutedRecord = getTopicRecord(state, 'Conflict');
  assert.equal(getTopicSignalStatus(mutedRecord), 'off');
  assert.equal(getTopicSignalExplanation('Conflict', mutedRecord).isMuted, true);

  state = resetTopicPreference(state, 'Conflict');
  const resetRecord = getTopicRecord(state, 'Conflict');
  assert.equal(getTopicSignalStatus(resetRecord), 'normal');
  assert.equal(resetRecord.likes, 0);
  assert.equal(resetRecord.dislikes, 0);
  assert.equal(resetRecord.mutedForever, false);
});

test('applyTopicPreferences hides off topics, reduces disliked topics, and boosts liked topics', () => {
  let state = createEmptyTopicPreferences();
  state = voteOnArticlePreference(state, 's1', 'Science', 'like');
  state = voteOnArticlePreference(state, 's2', 'Science', 'like');
  state = voteOnArticlePreference(state, 'p1', 'Politics', 'dislike');
  state = voteOnArticlePreference(state, 'p2', 'Politics', 'dislike');
  state = muteTopicForever(state, 'Conflict');

  const articles: Article[] = [
    makeArticle('__ftue_welcome__'),
    makeArticle('c1', 'Conflict'),
    makeArticle('h1', 'Health'),
    makeArticle('p1', 'Politics'),
    makeArticle('p2', 'Politics'),
    makeArticle('s1', 'Science'),
  ];

  const shaped = applyTopicPreferences(articles, state);
  assert.deepEqual(
    shaped.map((a) => a.id),
    ['__ftue_welcome__', 's1', 'h1', 'p1']
  );
});

test('getArticleTags returns up to 3 deduplicated tags and falls back to topic + region', () => {
  assert.deepEqual(
    getArticleTags(makeArticle('1', 'Sports', { region: 'Asia', tags: ['Sports', 'India', 'Cricket'] })),
    ['Sports', 'India', 'Cricket']
  );
  assert.deepEqual(
    getArticleTags(makeArticle('2', 'Conflict', { region: 'Europe' })),
    ['Conflict', 'Europe']
  );
  assert.deepEqual(
    getArticleTags(makeArticle('3', 'Science', { region: 'Global' })),
    ['Science']
  );
});

test('multi-tag voting scores all tags and muting a specific tag hides only matching stories', () => {
  let state = createEmptyTopicPreferences();
  state = voteOnArticlePreference(state, 'a1', ['Sports', 'India', 'Cricket'], 'like');
  state = voteOnArticlePreference(state, 'a2', ['Science', 'AI'], 'like');
  state = voteOnArticlePreference(state, 'a3', ['Science', 'AI'], 'like');

  assert.equal(getTopicRecord(state, 'Cricket').likes, 1);
  assert.equal(getTopicRecord(state, 'India').likes, 1);
  assert.equal(getTopicSignalStatus(getTopicRecord(state, 'AI')), 'boosted');

  state = muteTopicForever(state, 'Cricket');

  const articles: Article[] = [
    makeArticle('sp1', 'Sports', { tags: ['Sports', 'India', 'Cricket'] }),
    makeArticle('sp2', 'Sports', { tags: ['Sports', 'Europe', 'Tennis'] }),
    makeArticle('ai1', 'Science', { tags: ['Science', 'AI'] }),
  ];

  const shaped = applyTopicPreferences(articles, state);
  assert.deepEqual(
    shaped.map((a) => a.id),
    ['ai1', 'sp2']
  );
});
