/* Track server-side step generation quotas per account and US Central calendar day. Reserve quota transactionally to prevent concurrent requests from exceeding the limit. */
import { randomUUID } from "node:crypto";
import { verifyGenerationAccount } from "./firebaseAdmin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// Use the Chicago time zone for US Central time to handle CST and CDT automatically.
const quotaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Get the current US Central date and the next local midnight as a UTC reset timestamp. */
function getStepQuotaWindow(now) {
  const parts = Object.fromEntries(quotaDateFormatter.formatToParts(now)
    .filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const nextMidnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1);
  let resetAt = nextMidnight;
  // Convert the next local midnight to an absolute time. A second correction accounts for daylight saving time changes.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = Object.fromEntries(quotaDateFormatter.formatToParts(resetAt)
      .filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const localTimestamp = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    resetAt = nextMidnight - (localTimestamp - resetAt);
  }
  return { day, resetAt };
}

/** Create a quota error that maps directly to an API response. */
function quotaError(status, code, message, extra = {}) {
  return Object.assign(new Error(message), { status, code, ...extra });
}

/** Verify the account and reserve quota for the day. Future requests automatically reclaim expired reservations. */
export async function reserveStepQuota(req) {
  const { app, uid } = await verifyGenerationAccount(req);
  const limit = Number(process.env.GEMINI_STEP_DAILY_LIMIT ?? 0);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid GEMINI_STEP_DAILY_LIMIT");
  const now = Date.now();
  const { day, resetAt } = getStepQuotaWindow(now);
  const db = getFirestore(app);
  const ref = db.doc(`users/${uid}/aiDailyUsage/${day}`);
  const reservationId = randomUUID();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const count = data.stepGenerationCount ?? 0;
    const reservations = Object.fromEntries(Object.entries(data.reservations || {}).filter(([, until]) => until > Date.now()));
    if (count + Object.keys(reservations).length >= limit) {
      throw quotaError(429, "STEP_QUOTA_EXCEEDED", "Daily generation quota is used or temporarily reserved. Please try again later.", {
        limit, resetAt: new Date(resetAt).toISOString(),
        retryAfterSeconds: count >= limit ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 60,
      });
    }
    // Generation has a 50-second server budget. Reservations expire after two minutes so a process exit cannot tie up quota indefinitely.
    reservations[reservationId] = Date.now() + 120000;
    transaction.set(ref, { stepGenerationCount: count, reservations, updatedAt: FieldValue.serverTimestamp() });
  });
  return { db, ref, uid, reservationId, limit, resetAt: new Date(resetAt).toISOString() };
}

/** Count successes and release failed reservations. Settling the same reservation twice cannot consume quota twice. */
export async function settleStepQuota(quota, success) {
  return quota.db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(quota.ref);
    const data = snapshot.data() || {};
    const reservations = { ...data.reservations };
    if (!reservations[quota.reservationId]) {
      if (success) throw new Error("Step quota reservation missing");
      return;
    }
    if (success && reservations[quota.reservationId] <= Date.now()) throw new Error("Step quota reservation expired");
    delete reservations[quota.reservationId];
    const count = (data.stepGenerationCount ?? 0) + (success ? 1 : 0);
    transaction.set(quota.ref, { stepGenerationCount: count, reservations, updatedAt: FieldValue.serverTimestamp() });
    return { limit: quota.limit, used: count, remaining: Math.max(0, quota.limit - count), resetAt: quota.resetAt };
  });
}
