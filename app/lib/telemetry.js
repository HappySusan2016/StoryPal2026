/* Telemetry configuration and event cleanup prevent stale disabled settings, invalid configuration, and undefined values from blocking batch writes. */

/** Sample the session using the current configuration. Reevaluate when it changes and always honor the disable setting. */
export function decideTelemetryEnabled(storage, enabled, sampleRate, random = Math.random) {
  if (!enabled) return false;
  const rate = Number.isFinite(sampleRate) ? Math.max(0, Math.min(1, sampleRate)) : 1;
  const key = `sp.telemetry.sampled.${rate}`;
  try {
    const existing = storage.getItem(key);
    if (existing === "true" || existing === "false") return existing === "true";
    const sampled = random() < rate;
    storage.setItem(key, String(sampled));
    return sampled;
  } catch {
    // Honor the collection setting and sampling rate even if the browser blocks session storage.
    return random() < rate;
  }
}

/** Remove undefined optional fields, which Firestore rejects, while preserving valid 0, false, and null values. */
export function cleanTelemetryPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

/** Aggregate actual telemetry events consistently across visit counts, zero-duration samples, and recent activity. */
export function calculateAnalyticsStats(sessions, events) {
    const byType = {};
    const byPath = {};
    const byClickName = {};
    const errors = [];
    const pageTimes = [];
    let totalVisibleMs = 0;
    let totalTimeMs = 0;
    let pageTimeCount = 0;

    const sortedEvents = [...events].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    sortedEvents.forEach((event) => {
      // Count events by type.
      byType[event.type] = (byType[event.type] || 0) + 1;

      // Count only page_view events as page visits, excluding sessions and clicks.
      if (event.type === "page_view" && event.path) {
        byPath[event.path] = (byPath[event.path] || 0) + 1;
      }

      // Count clicks by explicit action name.
      if (event.type === "click" && event.name) {
        byClickName[event.name] = (byClickName[event.name] || 0) + 1;
      }

      // Collect errors by timestamp.
      if (event.type === "error" || event.type === "unhandledrejection") {
        errors.push({
          message: event.message || "Unknown error",
          path: event.path || "unknown",
          ts: event.ts,
          filename: event.filename,
          lineno: event.lineno,
        });
      }

      // Zero visible duration is a valid page timing sample.
      if (event.type === "page_time") {
        totalVisibleMs += Number(event.visibleMs) || 0;
        totalTimeMs += Number(event.totalMs) || 0;
        pageTimeCount++;
        pageTimes.push({
          fromPath: event.fromPath || "unknown",
          toPath: event.toPath || "unknown",
          visibleMs: event.visibleMs || 0,
          totalMs: event.totalMs || 0,
          ts: event.ts,
        });
      }
    });

    // Sort click actions by count.
    const topClicks = Object.entries(byClickName)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Sort pages by visit count.
    const topPaths = Object.entries(byPath)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalSessions: sessions.length,
      totalEvents: events.length,
      byType,
      byPath,
      topClicks,
      topPaths,
      errors: errors.slice(0, 20), // Most recent 20 errors
      pageTimes,
      avgVisibleMs: pageTimeCount > 0 ? totalVisibleMs / pageTimeCount : 0,
      avgTotalMs: pageTimeCount > 0 ? totalTimeMs / pageTimeCount : 0,
      recentEvents: sortedEvents.slice(0, 50),
    };
  }

