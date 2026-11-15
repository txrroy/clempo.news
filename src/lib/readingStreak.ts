export interface ReadingStreakState {
  completedDates: string[];
}

const STORAGE_KEY = 'snappylit_reading_streak_v1';
const PACIFIC_TIMEZONE = 'America/Los_Angeles';
const MAX_STORED_DAYS = 365;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

let inMemoryFallback: ReadingStreakState = {
  completedDates: [],
};

export function createEmptyReadingStreak(): ReadingStreakState {
  return {
    completedDates: [],
  };
}

function formatYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getDatePartsInTimeZone(
  date: Date,
  timeZone?: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value;
    return value ? Number(value) : 0;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour') % 24,
    minute: getPart('minute'),
  };
}

/**
 * Returns the YYYY-MM-DD calendar date key for `date` in the user's local
 * timezone (or an explicit IANA timezone when provided).
 */
export function getLocalDateKey(date: Date = new Date(), timeZone?: string): string {
  try {
    const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
    return formatYmd(year, month, day);
  } catch {
    return formatYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
}

/**
 * Shifts a YYYY-MM-DD date key by `deltaDays` calendar days safely across DST.
 */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + deltaDays));
  return formatYmd(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
}

function diffDateKeys(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return 0;
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Records a completed daily edition on `dateKey` (YYYY-MM-DD), keeping a sorted,
 * deduplicated list of completed days.
 */
export function recordCaughtUpDay(
  state: ReadingStreakState,
  dateKey: string
): ReadingStreakState {
  if (!parseDateKey(dateKey)) return state;
  if (state.completedDates.includes(dateKey)) return state;

  const uniqueSorted = Array.from(new Set([...state.completedDates, dateKey]))
    .filter((key) => Boolean(parseDateKey(key)))
    .sort();

  const trimmed =
    uniqueSorted.length > MAX_STORED_DAYS
      ? uniqueSorted.slice(uniqueSorted.length - MAX_STORED_DAYS)
      : uniqueSorted;

  return {
    completedDates: trimmed,
  };
}

/**
 * Computes the current consecutive-day reading streak ending on `todayKey`
 * (or on yesterday if `todayKey` has not been completed yet).
 */
export function getCurrentStreak(
  state: ReadingStreakState,
  todayKey: string = getLocalDateKey()
): number {
  if (!parseDateKey(todayKey) || state.completedDates.length === 0) return 0;

  const completedSet = new Set(state.completedDates);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  let cursor = completedSet.has(todayKey)
    ? todayKey
    : completedSet.has(yesterdayKey)
      ? yesterdayKey
      : null;

  if (!cursor) return 0;

  let streak = 0;
  while (completedSet.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function formatStreakLine(streakDays: number): string | null {
  if (streakDays <= 0) return null;
  if (streakDays === 1) return '1 day streak.';
  return `${streakDays} days in a row.`;
}

function getPacificDateTimeInstant(
  dateKey: string,
  hour: number,
  minute: number
): Date {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return new Date();

  // Initial UTC estimate assuming PST (UTC-8)
  const pstGuessMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour + 8, minute, 0);

  try {
    const actualPacific = getDatePartsInTimeZone(new Date(pstGuessMs), PACIFIC_TIMEZONE);
    const actualWallMs = Date.UTC(
      actualPacific.year,
      actualPacific.month - 1,
      actualPacific.day,
      actualPacific.hour,
      actualPacific.minute,
      0
    );
    const targetWallMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute, 0);
    return new Date(pstGuessMs + (targetWallMs - actualWallMs));
  } catch {
    // Fallback to fixed PST (UTC-8) if Intl timeZone is unavailable
    return new Date(pstGuessMs);
  }
}

export interface NextEditionTimeOptions {
  now?: Date;
  latestEditionDate?: string | null;
  publishHourPacific?: number;
  publishMinutePacific?: number;
  localTimeZone?: string;
}

/**
 * Converts the daily 10:00 AM Pacific publish schedule into the user's local
 * time and relative day (e.g., "New stories at 10 AM tomorrow." or
 * "New stories at 11:30 PM today.").
 */
export function getNextEditionLocalTimeText(
  options: NextEditionTimeOptions = {}
): string {
  const now = options.now ?? new Date();
  const publishHourPacific = options.publishHourPacific ?? 10;
  const publishMinutePacific = options.publishMinutePacific ?? 0;
  const localTimeZone = options.localTimeZone;

  let todayPacKey: string;
  try {
    todayPacKey = getLocalDateKey(now, PACIFIC_TIMEZONE);
  } catch {
    const pstApprox = new Date(now.getTime() - 8 * 3_600_000);
    todayPacKey = formatYmd(
      pstApprox.getUTCFullYear(),
      pstApprox.getUTCMonth() + 1,
      pstApprox.getUTCDate()
    );
  }

  const todayPublishInstant = getPacificDateTimeInstant(
    todayPacKey,
    publishHourPacific,
    publishMinutePacific
  );

  const todayEditionAlreadyPublished = Boolean(
    options.latestEditionDate && options.latestEditionDate >= todayPacKey
  );

  const targetPacKey =
    now.getTime() < todayPublishInstant.getTime() && !todayEditionAlreadyPublished
      ? todayPacKey
      : shiftDateKey(todayPacKey, 1);

  const nextPublishInstant = getPacificDateTimeInstant(
    targetPacKey,
    publishHourPacific,
    publishMinutePacific
  );

  const localTargetParts = getDatePartsInTimeZone(nextPublishInstant, localTimeZone);
  const includeMinutes = localTargetParts.minute !== 0;

  let formattedTime: string;
  try {
    formattedTime = new Intl.DateTimeFormat('en-US', {
      ...(localTimeZone ? { timeZone: localTimeZone } : {}),
      hour: 'numeric',
      ...(includeMinutes ? { minute: '2-digit' } : {}),
      hour12: true,
    })
      .format(nextPublishInstant)
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    const hour24 = localTargetParts.hour;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    formattedTime = includeMinutes
      ? `${hour12}:${String(localTargetParts.minute).padStart(2, '0')} ${period}`
      : `${hour12} ${period}`;
  }

  const nowLocalKey = getLocalDateKey(now, localTimeZone);
  const targetLocalKey = formatYmd(
    localTargetParts.year,
    localTargetParts.month,
    localTargetParts.day
  );
  const dayDiff = diffDateKeys(nowLocalKey, targetLocalKey);

  let dayPhrase: string;
  if (dayDiff === 0) {
    dayPhrase = 'today';
  } else if (dayDiff === 1) {
    dayPhrase = 'tomorrow';
  } else {
    try {
      dayPhrase = new Intl.DateTimeFormat('en-US', {
        ...(localTimeZone ? { timeZone: localTimeZone } : {}),
        weekday: 'long',
      }).format(nextPublishInstant);
    } catch {
      dayPhrase = 'soon';
    }
  }

  return `New stories at ${formattedTime} ${dayPhrase}.`;
}

export function loadReadingStreak(): ReadingStreakState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyReadingStreak();
      const parsed = JSON.parse(raw) as Partial<ReadingStreakState>;
      const validDates = Array.isArray(parsed.completedDates)
        ? parsed.completedDates.filter(
            (item): item is string =>
              typeof item === 'string' && Boolean(parseDateKey(item))
          )
        : [];
      return {
        completedDates: Array.from(new Set(validDates)).sort(),
      };
    }
  } catch {
    // ignore storage errors
  }
  return inMemoryFallback;
}

export function saveReadingStreak(state: ReadingStreakState): void {
  inMemoryFallback = state;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore storage errors
  }
}
