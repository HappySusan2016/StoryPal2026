"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";

const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "true";
const SAMPLE_RATE = Number(process.env.NEXT_PUBLIC_TELEMETRY_SAMPLE_RATE ?? "1"); // 0..1
const MAX_QUEUE = Number(process.env.NEXT_PUBLIC_TELEMETRY_MAX_QUEUE ?? "50");
const FLUSH_EVERY_MS = Number(process.env.NEXT_PUBLIC_TELEMETRY_FLUSH_MS ?? "5000");

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "ssr";
  const key = "sp.telemetry.sessionId";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const id =
    (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
    `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(key, id);
  return id;
}

function getOrDecideEnabled() {
  if (typeof window === "undefined") return false;
  const key = "sp.telemetry.enabled";
  const existing = window.sessionStorage.getItem(key);
  if (existing === "true") return true;
  if (existing === "false") return false;

  const sr = Number.isFinite(SAMPLE_RATE) ? SAMPLE_RATE : 1;
  const decided = ENABLED && Math.random() < Math.max(0, Math.min(1, sr));
  window.sessionStorage.setItem(key, decided ? "true" : "false");
  return decided;
}

export default function TelemetryProvider() {
  const pathname = usePathname();

  const enabledRef = useRef(false);
  const uidRef = useRef(null);
  const sessionIdRef = useRef(null);

  const currentPathRef = useRef("");
  const pageStartAtRef = useRef(0);

  const visibleSinceRef = useRef(0);
  const visibleAccumMsRef = useRef(0);

  const queueRef = useRef([]);
  const flushingRef = useRef(false);

  function startVisibleTimer() {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible" && !visibleSinceRef.current) {
      visibleSinceRef.current = Date.now();
    }
  }

  function stopVisibleTimer() {
    if (!visibleSinceRef.current) return;
    visibleAccumMsRef.current += Date.now() - visibleSinceRef.current;
    visibleSinceRef.current = 0;
  }

  function enqueue(type, payload = {}) {
    if (!enabledRef.current) return;
    if (!uidRef.current) return;

    queueRef.current.push({
      type,
      path: currentPathRef.current || "",
      ts: Date.now(),
      ...payload,
    });

    if (queueRef.current.length > MAX_QUEUE) {
      queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
    }
  }

  async function flush(reason = "interval") {
    if (!enabledRef.current) return;
    if (!uidRef.current) return;
    if (!sessionIdRef.current) return;
    if (flushingRef.current) return;
    if (queueRef.current.length === 0) return;

    flushingRef.current = true;

    const uid = uidRef.current;
    const sessionId = sessionIdRef.current;
    const events = queueRef.current.splice(0, queueRef.current.length);

    try {
      const batch = writeBatch(db);

      const sessionDoc = doc(db, "users", uid, "telemetrySessions", sessionId);
      batch.set(
        sessionDoc,
        {
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          lastFlushReason: reason,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
        { merge: true }
      );

      const eventsCol = collection(
        db,
        "users",
        uid,
        "telemetrySessions",
        sessionId,
        "events"
      );
      for (const e of events) {
        batch.set(doc(eventsCol), e);
      }

      await batch.commit();
      // Debug: log successful flush in dev mode
      if (process.env.NODE_ENV === "development") {
        console.log(`[Telemetry] Flushed ${events.length} events (${reason})`);
      }
    } catch (err) {
      // Log errors in development for debugging
      if (process.env.NODE_ENV === "development") {
        console.error("[Telemetry] Flush failed:", err);
      }
      // Best-effort: put events back (bounded) without logging to telemetry
      queueRef.current.unshift(...events);
      if (queueRef.current.length > MAX_QUEUE) {
        queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
      }
    } finally {
      flushingRef.current = false;
    }
  }

  useEffect(() => {
    enabledRef.current = getOrDecideEnabled();
    sessionIdRef.current = getOrCreateSessionId();

    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Telemetry] Initialized:", {
        enabled: enabledRef.current,
        sessionId: sessionIdRef.current,
        envEnabled: ENABLED,
        sampleRate: SAMPLE_RATE,
      });
    }

    currentPathRef.current = pathname || "";
    pageStartAtRef.current = Date.now();
    startVisibleTimer();

    if (!enabledRef.current) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Telemetry] Disabled - check NEXT_PUBLIC_TELEMETRY_ENABLED");
      }
      return;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      uidRef.current = u?.uid || null;
      if (process.env.NODE_ENV === "development") {
        console.log("[Telemetry] Auth state:", { uid: uidRef.current });
      }
      if (uidRef.current) {
        enqueue("session_start", { sessionId: sessionIdRef.current });
        flush("session_start");
      } else {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Telemetry] No user - telemetry will not collect data");
        }
      }
    });

    // Click traces: capture ONLY elements you explicitly mark with data-telemetry
    const onClickCapture = (e) => {
      const el = e.target?.closest?.("[data-telemetry]");
      if (!el) return;

      const name = el.getAttribute("data-telemetry") || "unknown";
      const tag = el.tagName ? el.tagName.toLowerCase() : "unknown";
      const href = tag === "a" ? el.getAttribute("href") : null;

      enqueue("click", { name, tag, href });
    };

    // Operational logs: errors + unhandled promise rejections
    const onError = (event) => {
      enqueue("error", {
        message: event?.message || "unknown",
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
      });
      flush("error");
    };

    const onUnhandledRejection = (event) => {
      const reason = event?.reason;
      enqueue("unhandledrejection", {
        message:
          (typeof reason === "string" && reason) ||
          reason?.message ||
          "unhandledrejection",
      });
      flush("unhandledrejection");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") startVisibleTimer();
      else stopVisibleTimer();
    };

    const interval = window.setInterval(() => flush("interval"), FLUSH_EVERY_MS);

    const onPageHide = () => {
      stopVisibleTimer();
      enqueue("page_time", {
        fromPath: currentPathRef.current || "",
        visibleMs: visibleAccumMsRef.current,
        totalMs: Date.now() - (pageStartAtRef.current || Date.now()),
      });
      flush("pagehide");
    };

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    // Optional manual hook for code-driven events
    window.storypalTelemetry = {
      track: (type, payload) => enqueue(type, payload),
      flush: () => flush("manual"),
    };

    return () => {
      clearInterval(interval);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      unsub();
      delete window.storypalTelemetry;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route changes: log page_view + page_time for previous route
  useEffect(() => {
    if (!enabledRef.current) return;
    if (!uidRef.current) return;

    stopVisibleTimer();

    const prevPath = currentPathRef.current || "";
    const now = Date.now();
    const totalMs = now - (pageStartAtRef.current || now);
    const visibleMs = visibleAccumMsRef.current;

    if (prevPath && prevPath !== pathname) {
      enqueue("page_time", { fromPath: prevPath, toPath: pathname, totalMs, visibleMs });
    }

    currentPathRef.current = pathname || "";
    pageStartAtRef.current = now;
    visibleAccumMsRef.current = 0;
    visibleSinceRef.current = 0;
    startVisibleTimer();

    enqueue("page_view", { toPath: pathname, fromPath: prevPath });
    flush("route_change");
  }, [pathname]);

  return null;
}


