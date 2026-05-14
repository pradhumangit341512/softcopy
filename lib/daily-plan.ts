import { db } from '@/lib/db';

/** Step a YYYY-MM-DD key back one day. UTC-anchored to dodge DST. */
function previousDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive days the user has logged ending today (or yesterday if today
 * is not yet logged, so users aren't punished mid-morning). A day counts
 * when either morning or evening exists. Walks at most HORIZON_DAYS back.
 */
const HORIZON_DAYS = 90;

export async function computeDailyPlanStreak(
  userId: string,
  todayKey: string,
): Promise<number> {
  const horizon = new Date(`${todayKey}T00:00:00.000Z`);
  horizon.setUTCDate(horizon.getUTCDate() - HORIZON_DAYS);

  const plans = await db.dailyPlan.findMany({
    where: { userId, date: { gte: horizon } },
    select: { dateKey: true, morning: true, evening: true },
  });

  const loggedKeys = new Set(
    plans
      .filter((p) => p.morning !== null || p.evening !== null)
      .map((p) => p.dateKey),
  );

  let cursor = loggedKeys.has(todayKey) ? todayKey : previousDateKey(todayKey);
  let streak = 0;
  while (loggedKeys.has(cursor) && streak < HORIZON_DAYS) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}
