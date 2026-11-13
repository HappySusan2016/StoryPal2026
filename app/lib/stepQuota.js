/* 服务端步骤生成额度：按账号及美国中部日期统计，通过事务预占防止并发超额。 */
import { randomUUID } from "node:crypto";
import { getAdminApp } from "./firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// 美国中部按芝加哥时区计算，自动适配 CST/CDT
const quotaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** 获取美国中部当日日期与次日零点，重置时间以 UTC 时间戳返回。 */
function getStepQuotaWindow(now) {
  const parts = Object.fromEntries(quotaDateFormatter.formatToParts(now)
    .filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const nextMidnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1);
  let resetAt = nextMidnight;
  // 将当地次日零点转换为真实时间，第二次校正覆盖夏令时偏移变化。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = Object.fromEntries(quotaDateFormatter.formatToParts(resetAt)
      .filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const localTimestamp = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    resetAt = nextMidnight - (localTimestamp - resetAt);
  }
  return { day, resetAt };
}

/** 构造可直接映射到接口响应的额度错误。 */
function quotaError(status, code, message, extra = {}) {
  return Object.assign(new Error(message), { status, code, ...extra });
}

/** 验证账号并预占当日额度；失效预占在后续请求中自动回收。 */
export async function reserveStepQuota(req) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw quotaError(401, "UNAUTHORIZED", "Please sign in to generate a step.");
  const app = getAdminApp();
  let uid;
  try {
    ({ uid } = await getAuth(app).verifyIdToken(token));
  } catch (error) {
    // 仅把无效令牌视为登录问题，基础设施异常保留为服务不可用。
    if (/^auth\/(argument-error|invalid-id-token|id-token-expired|id-token-revoked|user-disabled)$/.test(error.code || "")) {
      throw quotaError(401, "UNAUTHORIZED", "Please sign in again.");
    }
    throw error;
  }
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
    // 服务端生成预算为 50 秒；预占保留两分钟，进程退出后不会永久占用额度。
    reservations[reservationId] = Date.now() + 120000;
    transaction.set(ref, { stepGenerationCount: count, reservations, updatedAt: FieldValue.serverTimestamp() });
  });
  return { db, ref, reservationId, limit, resetAt: new Date(resetAt).toISOString() };
}

/** 成功时确认计数，失败时仅释放预占；同一预占重复结算不会重复扣次。 */
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
