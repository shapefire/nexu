import { gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { bots } from "../db/schema/index.js";

export const DAILY_BOT_LIMIT = Number.parseInt(
  process.env.DAILY_BOT_LIMIT ?? "50",
  10,
);

/** Returns today's midnight in Asia/Shanghai as a UTC ISO string. */
export function todayMidnightCST(): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString();
}

/** Returns tomorrow's midnight in Asia/Shanghai as a UTC ISO string. */
export function tomorrowMidnightCST(): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString();
}

export async function checkBotQuota(): Promise<{
  available: boolean;
  resetsAt: string;
}> {
  const resetsAt = tomorrowMidnightCST();

  if (DAILY_BOT_LIMIT <= 0) {
    return { available: false, resetsAt };
  }

  const midnight = todayMidnightCST();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bots)
    .where(gte(bots.createdAt, midnight));
  const todayCount = rows[0]?.count ?? 0;

  return { available: todayCount < DAILY_BOT_LIMIT, resetsAt };
}
