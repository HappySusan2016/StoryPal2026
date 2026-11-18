"use client";

import { calculateAnalyticsStats } from "../lib/telemetry";
import PortalShell from "../components/PortalShell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  getDocsFromServer,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";
import { useTranslation } from "../hooks/useTranslation";

/** @module Portal styling for analytics with all metrics and details retained */
export default function AnalyticsDashboard() {
  return <PortalShell><AnalyticsContent /></PortalShell>;
}

/** @module Analytics queries, aggregation, and display */
function AnalyticsContent() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [telemetryStatus, setTelemetryStatus] = useState(null);

  // Require authenticated user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setStats(null);
      setLoading(true);
      setError(null);
      if (!user) {
        setAuthReady(false);
        setCurrentUser(null);
        router.replace("/parent/auth");
        return;
      }
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  // Load telemetry data
  useEffect(() => {
    if (!authReady || !currentUser) return;
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      try {
        // Wait for the initial batch or queued events to finish writing so the query does not return empty results prematurely.
        let flushTimeout;
        try {
          // Firestore writes can wait for reconnection while offline. Keep the analytics page from loading indefinitely.
          await Promise.race([
            window.storypalTelemetry?.flush(),
            new Promise(resolve => { flushTimeout = setTimeout(resolve, 5000); }),
          ]);
        } finally {
          clearTimeout(flushTimeout);
        }
        if (cancelled) return;
        setTelemetryStatus(window.storypalTelemetry?.getStatus() || null);
        const uid = currentUser.uid;
        const sessionsRef = collection(db, "users", uid, "telemetrySessions");
        const sessionsQuery = query(
          sessionsRef,
          orderBy("updatedAt", "desc"),
          limit(100)
        );

        const sessionsSnapshot = await getDocsFromServer(sessionsQuery);
        const sessions = [];
        const allEvents = [];

        // Load events for each session
        for (const sessionDoc of sessionsSnapshot.docs) {
          const sessionData = sessionDoc.data();
          const eventsRef = collection(
            db,
            "users",
            uid,
            "telemetrySessions",
            sessionDoc.id,
            "events"
          );
          const eventsQuery = query(eventsRef, orderBy("ts", "desc"));
          const eventsSnapshot = await getDocsFromServer(eventsQuery);

          const events = eventsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          sessions.push({
            id: sessionDoc.id,
            ...sessionData,
            eventCount: events.length,
          });

          allEvents.push(...events);
        }

        // Calculate statistics
        const stats = calculateAnalyticsStats(sessions, allEvents);
        if (!cancelled) setStats(stats);
      } catch (err) {
        console.error("Failed to load analytics", err);
        let errorMessage = err.message || "Failed to load analytics data";
        // Check if it's an index error
        if (
          err.message?.includes("index") ||
          err.code === "failed-precondition"
        ) {
          errorMessage =
            "Firestore index required. Check the Firebase Console for index creation link, or wait a moment for auto-indexing.";
        }
        if (!cancelled) setError(errorMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAnalytics();
    return () => { cancelled = true; };
  }, [authReady, currentUser, refreshVersion]);

  function formatTimestamp(ts) {
    if (!ts) return "Unknown";
    try {
      const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      return date.toLocaleString(language);
    } catch {
      return "Invalid date";
    }
  }

  function formatDuration(ms) {
    if (!ms || ms === 0) return "0s";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /** @module Refresh and collection diagnostics distinguish disabled tracking or failed writes from empty results */
  const analyticsHeader = (
    <div className="section-head analytics-head">
      <h1>{t("Analytics Dashboard")}</h1>
      <button className="secondary" type="button" disabled={loading} onClick={() => setRefreshVersion(version => version + 1)} data-telemetry="analytics_refresh">
        {t("Refresh")}
      </button>
    </div>
  );
  const trackingMessage = telemetryStatus?.lastError
    ? "Activity could not be saved. Please check your connection or access permissions."
    : telemetryStatus?.configured === false
    ? "Activity tracking is currently disabled."
    : telemetryStatus?.enabled === false
    ? "This session is not included in activity tracking."
    : "Activity tracking is ready. Browse a few pages, then refresh.";

  if (!authReady || loading) {
    return (
      <main className="analytics-page">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-lg text-zinc-600">{t("Loading analytics...")}</div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="analytics-page">
        <div className="max-w-7xl mx-auto">
          {analyticsHeader}
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-4">
            <h2 className="font-semibold mb-2">{t("Error loading analytics")}</h2>
            <p className="text-sm">{t(error)}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <main className="analytics-page">
        <div className="max-w-7xl mx-auto">
          {analyticsHeader}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8">
            <p className="text-zinc-600 mb-4">{t("No telemetry data available yet. Start using the app to generate analytics.")}</p>
            <p className="notice" role={telemetryStatus?.lastError ? "alert" : "status"}>
              {t(trackingMessage)} {telemetryStatus?.lastError && <code>{telemetryStatus.lastError}</code>}
            </p>
            <details className="analytics-troubleshooting"><summary>{t("Troubleshooting Steps:")}</summary>
            <div className="bg-white rounded-lg p-4 border border-zinc-200">
              <h3 className="font-semibold text-zinc-900 mb-2">{t("Troubleshooting Steps:")}</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700">
                <li>{t("Open browser console (F12) and check for")}{" "}
                  <code className="bg-zinc-100 px-1 rounded">{t("[Telemetry]")}</code>{" "}{t("messages")}</li>
                <li>{t("Verify telemetry is enabled: Check if")}{" "}
                  <code className="bg-zinc-100 px-1 rounded">{t("window.storypalTelemetry")}</code>{" "}{t("exists in console")}</li>
                <li>{t("Make sure you're signed in (telemetry only works for authenticated users)")}</li>
                <li>{t("Navigate between pages and click buttons to generate events")}</li>
                <li>{t("Wait 5-10 seconds for events to flush to Firestore")}</li>
                <li>{t("Check Firestore Console:")}{" "}
                  <code className="bg-zinc-100 px-1 rounded">{t("users/")}{currentUser?.uid}{t("/telemetrySessions")}</code>
                </li>
              </ol>
            </div>
            </details>
            <p className="text-sm text-zinc-500 mt-4">
              <strong>{t("Note:")}</strong>{t("This is a custom analytics dashboard that reads from Firestore. It's different from Firebase Analytics (Google Analytics) shown in the Firebase Console.")}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="analytics-page">
      <div className="max-w-7xl mx-auto">
        {analyticsHeader}
        <p className="text-zinc-600 mb-6">{t("Telemetry data and user interaction analytics")}</p>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <div className="text-sm text-zinc-600 mb-1">{t("Total Sessions")}</div>
            <div className="text-3xl font-bold text-zinc-900">
              {stats.totalSessions}
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <div className="text-sm text-zinc-600 mb-1">{t("Total Events")}</div>
            <div className="text-3xl font-bold text-zinc-900">
              {stats.totalEvents}
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <div className="text-sm text-zinc-600 mb-1">{t("Avg Time on Page")}</div>
            <div className="text-3xl font-bold text-zinc-900">
              {formatDuration(stats.avgVisibleMs)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <div className="text-sm text-zinc-600 mb-1">{t("Errors")}</div>
            <div className="text-3xl font-bold text-red-600">
              {stats.errors.length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Events by Type */}
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("Events by Type")}</h2>
            <div className="space-y-2">
              {Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 capitalize">
                      {type.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-zinc-100 rounded-full h-2">
                        <div
                          className="bg-[#315e4a] h-2 rounded-full"
                          style={{
                            width: `${(count / stats.totalEvents) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 w-12 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Most Clicked Actions */}
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("Most Clicked Actions")}</h2>
            {stats.topClicks.length > 0 ? (
              <div className="space-y-2">
                {stats.topClicks.map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-zinc-700">
                      {name.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-semibold text-zinc-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{t("No click data available")}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Page Views by Path */}
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("Page Views by Path")}</h2>
            {stats.topPaths.length > 0 ? (
              <div className="space-y-2">
                {stats.topPaths.map(([path, count]) => (
                  <div
                    key={path}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-zinc-700 font-mono">
                      {path || "(root)"}
                    </span>
                    <span className="text-sm font-semibold text-zinc-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{t("No page view data")}</p>
            )}
          </div>

          {/* Time on Page Stats */}
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("Time on Page")}</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-zinc-600 mb-1">{t("Average Visible Time")}</div>
                <div className="text-2xl font-bold text-zinc-900">
                  {formatDuration(stats.avgVisibleMs)}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">{t("Average Total Time")}</div>
                <div className="text-2xl font-bold text-zinc-900">
                  {formatDuration(stats.avgTotalMs)}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 mb-1">{t("Page Time Events")}</div>
                <div className="text-2xl font-bold text-zinc-900">
                  {stats.pageTimes.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Logs */}
        {stats.errors.length > 0 && (
          <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200 mb-6">
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("Recent Errors (")}{stats.errors.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {stats.errors.map((err, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-red-50 border border-red-200"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-semibold text-red-900">
                      {err.message}
                    </span>
                    <span className="text-xs text-red-700">
                      {formatTimestamp(err.ts)}
                    </span>
                  </div>
                  <div className="text-xs text-red-700 mt-1">{t("Path:")}{err.path}
                    {err.filename && ` • File: ${err.filename}`}
                    {err.lineno && ` • Line: ${err.lineno}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm border border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("Recent Activity (Last 50 Events)")}</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats.recentEvents.map((event, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-500 uppercase w-24">
                    {event.type}
                  </span>
                  <span className="text-sm text-zinc-700 font-mono">
                    {event.path || "(root)"}
                  </span>
                  {event.name && (
                    <span className="text-xs text-zinc-500">
                      • {event.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  {formatTimestamp(event.ts)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

