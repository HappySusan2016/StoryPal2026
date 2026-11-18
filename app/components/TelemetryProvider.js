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
import { decideTelemetryEnabled, cleanTelemetryPayload } from "../lib/telemetry";
import { auth, db } from "../lib/firebaseClient";

const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "true";
const SAMPLE_RATE = Number(process.env.NEXT_PUBLIC_TELEMETRY_SAMPLE_RATE ?? "1"); // 0..1
const MAX_QUEUE = Math.min(400, Math.max(1, Number(process.env.NEXT_PUBLIC_TELEMETRY_MAX_QUEUE) || 50));
const FLUSH_EVERY_MS = Math.max(1000, Number(process.env.NEXT_PUBLIC_TELEMETRY_FLUSH_MS) || 5000);

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "ssr";
  const key = "sp.telemetry.sessionId";
  const createId = () => window.crypto?.randomUUID?.() || `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = createId();
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return createId();
  }
}

/** @module Authenticated telemetry collection, batch writes, and page timing */
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
  const flushPromiseRef = useRef(null);
  const lastFlushAtRef = useRef(null);
  const lastErrorRef = useRef(null);
  const sessionStartedAtRef = useRef(null);

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
      ...cleanTelemetryPayload(payload),
    });

    if (queueRef.current.length > MAX_QUEUE) {
      queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
    }
  }

  /** Share the write promise so analytics queries can wait for the initial batch already in flight. */
  async function flush(reason = "interval") {
    if (!enabledRef.current || !uidRef.current || !sessionIdRef.current) return;
    if (flushPromiseRef.current) {
      await flushPromiseRef.current;
      if (lastErrorRef.current) return;
    }
    if (!queueRef.current.length) return;

    const uid = uidRef.current;
    const sessionId = sessionIdRef.current;
    const events = queueRef.current.splice(0, queueRef.current.length);
    const pending = (async () => {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, "users", uid, "telemetrySessions", sessionId), {
          createdAt: sessionStartedAtRef.current,
          updatedAt: serverTimestamp(),
          lastFlushReason: reason,
          userAgent: navigator.userAgent,
        }, { merge: true });
        const eventsCol = collection(db, "users", uid, "telemetrySessions", sessionId, "events");
        for (const event of events) batch.set(doc(eventsCol), event);
        await batch.commit();
        if (uidRef.current === uid) {
          lastFlushAtRef.current = Date.now();
          lastErrorRef.current = null;
        }
      } catch (error) {
        // Requeue failed events under their original account to prevent writing them to a different account after a switch.
        if (uidRef.current === uid) {
          lastErrorRef.current = error.code || "write-failed";
          queueRef.current.unshift(...events);
          queueRef.current.splice(0, Math.max(0, queueRef.current.length - MAX_QUEUE));
        }
        if (process.env.NODE_ENV === "development") console.error("[Telemetry] Flush failed:", error);
      }
    })();
    flushPromiseRef.current = pending;
    try {
      await pending;
    } finally {
      if (flushPromiseRef.current === pending) flushPromiseRef.current = null;
    }
  }

  /** Expose only collection diagnostics in status and keep user identities and event content private. */
  function getStatus() {
    return {
      configured: ENABLED,
      enabled: enabledRef.current,
      authenticated: Boolean(uidRef.current),
      lastFlushAt: lastFlushAtRef.current,
      lastError: lastErrorRef.current,
    };
  }

  useEffect(() => {
    enabledRef.current = decideTelemetryEnabled(window.sessionStorage, ENABLED, SAMPLE_RATE);
    sessionIdRef.current = getOrCreateSessionId();
    sessionStartedAtRef.current = new Date();

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

    window.storypalTelemetry = {
      track: (type, payload) => enqueue(type, payload),
      flush: () => flush("manual"),
      getStatus,
    };

    if (!enabledRef.current) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Telemetry] Disabled - check NEXT_PUBLIC_TELEMETRY_ENABLED");
      }
      return () => { delete window.storypalTelemetry; };
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid || null;
      if (uid !== uidRef.current) {
        queueRef.current = [];
        lastFlushAtRef.current = null;
        lastErrorRef.current = null;
        visibleAccumMsRef.current = 0;
        visibleSinceRef.current = 0;
        pageStartAtRef.current = Date.now();
        startVisibleTimer();
      }
      uidRef.current = uid;
      if (process.env.NODE_ENV === "development") {
        console.log("[Telemetry] Auth state:", { uid: uidRef.current });
      }
      if (uidRef.current) {
        // The auth callback can run after the route effect. Record the current page on initial sign-in too.
        enqueue("session_start", { sessionId: sessionIdRef.current });
        enqueue("page_view", { toPath: currentPathRef.current, fromPath: "" });
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
    if (!uidRef.current) {
      currentPathRef.current = pathname || "";
      return;
    }

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


