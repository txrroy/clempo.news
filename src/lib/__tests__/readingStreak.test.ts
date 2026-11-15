import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyReadingStreak,
  formatStreakLine,
  getCurrentStreak,
  getNextEditionLocalTimeText,
  recordCaughtUpDay,
  shiftDateKey,
// @ts-expect-error Node 24 native TS runner requires .ts extension
} from '../readingStreak.ts';

test('recordCaughtUpDay and getCurrentStreak compute consecutive streaks accurately', () => {
  let state = createEmptyReadingStreak();
  assert.equal(getCurrentStreak(state, '2026-11-14'), 0);

  state = recordCaughtUpDay(state, '2026-11-11');
  state = recordCaughtUpDay(state, '2026-11-12');
  state = recordCaughtUpDay(state, '2026-11-13');
  state = recordCaughtUpDay(state, '2026-11-14');
  // Recording same day twice is a no-op
  state = recordCaughtUpDay(state, '2026-11-14');

  assert.equal(state.completedDates.length, 4);
  assert.equal(getCurrentStreak(state, '2026-11-14'), 4);
  assert.equal(formatStreakLine(4), '4 days in a row.');
});

test('getCurrentStreak resets after a missed day and handles month boundaries', () => {
  let state = createEmptyReadingStreak();
  state = recordCaughtUpDay(state, '2026-02-26');
  state = recordCaughtUpDay(state, '2026-02-28');
  state = recordCaughtUpDay(state, '2026-03-01');

  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(getCurrentStreak(state, '2026-03-01'), 2);
  assert.equal(formatStreakLine(1), '1 day streak.');
  assert.equal(formatStreakLine(2), '2 days in a row.');
  assert.equal(formatStreakLine(0), null);
});

test('getNextEditionLocalTimeText converts 10am PST into local time across timezones', () => {
  // 2026-11-14 22:59 PST (UTC-8) -> 2026-11-15T06:59:00Z
  const nightPst = new Date('2026-11-15T06:59:00Z');

  // Los Angeles (PST, UTC-8): Nov 14 22:59 -> Nov 15 10:00 AM (tomorrow)
  assert.equal(
    getNextEditionLocalTimeText({
      now: nightPst,
      latestEditionDate: '2026-11-14',
      localTimeZone: 'America/Los_Angeles',
    }),
    'New stories at 10 AM tomorrow.'
  );

  // New York (EST, UTC-5): Nov 15 01:59 AM -> Nov 15 1:00 PM (today)
  assert.equal(
    getNextEditionLocalTimeText({
      now: nightPst,
      latestEditionDate: '2026-11-14',
      localTimeZone: 'America/New_York',
    }),
    'New stories at 1 PM today.'
  );

  // Earlier in the evening (Nov 14 18:00 PST = 21:00 EST): Nov 15 1:00 PM is tomorrow in NY
  const eveningPst = new Date('2026-11-15T02:00:00Z');
  assert.equal(
    getNextEditionLocalTimeText({
      now: eveningPst,
      latestEditionDate: '2026-11-14',
      localTimeZone: 'America/New_York',
    }),
    'New stories at 1 PM tomorrow.'
  );

  // India (IST, UTC+5:30): Nov 15 12:29 PM -> Nov 15 11:30 PM (today)
  assert.equal(
    getNextEditionLocalTimeText({
      now: nightPst,
      latestEditionDate: '2026-11-14',
      localTimeZone: 'Asia/Kolkata',
    }),
    'New stories at 11:30 PM today.'
  );

  // Tokyo (JST, UTC+9): Nov 15 15:59 -> Nov 16 3:00 AM (tomorrow)
  assert.equal(
    getNextEditionLocalTimeText({
      now: nightPst,
      latestEditionDate: '2026-11-14',
      localTimeZone: 'Asia/Tokyo',
    }),
    'New stories at 3 AM tomorrow.'
  );
});

test('getNextEditionLocalTimeText handles morning before 10am PST when showing fallback vs today edition', () => {
  // 2026-11-14 08:00 PST (UTC-8) -> 2026-11-14T16:00:00Z
  const morningPst = new Date('2026-11-14T16:00:00Z');

  // Today's edition NOT yet published (still showing yesterday's 2026-11-13)
  assert.equal(
    getNextEditionLocalTimeText({
      now: morningPst,
      latestEditionDate: '2026-11-13',
      localTimeZone: 'America/Los_Angeles',
    }),
    'New stories at 10 AM today.'
  );

  // Today's edition ALREADY published early (2026-11-14)
  assert.equal(
    getNextEditionLocalTimeText({
      now: morningPst,
      latestEditionDate: '2026-11-14',
      localTimeZone: 'America/Los_Angeles',
    }),
    'New stories at 10 AM tomorrow.'
  );
});

test('getNextEditionLocalTimeText handles PDT summer months cleanly', () => {
  // 2026-07-15 18:00 PDT (UTC-7) -> 2026-07-16T01:00:00Z
  const summerEveningPdt = new Date('2026-07-16T01:00:00Z');

  assert.equal(
    getNextEditionLocalTimeText({
      now: summerEveningPdt,
      latestEditionDate: '2026-07-15',
      localTimeZone: 'America/Los_Angeles',
    }),
    'New stories at 10 AM tomorrow.'
  );

  assert.equal(
    getNextEditionLocalTimeText({
      now: summerEveningPdt,
      latestEditionDate: '2026-07-15',
      localTimeZone: 'America/New_York',
    }),
    'New stories at 1 PM tomorrow.'
  );
});
