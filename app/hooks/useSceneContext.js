"use client";

import { useMemo, useSyncExternalStore } from "react";

/** @module The client reads the legacy scene guide from the session while the server renders the loading state */
function subscribeSession(onChange) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSessionSnapshot() {
  return JSON.stringify({
    user: { name: sessionStorage.getItem("sp.userName") || "" },
    doctor: { name: sessionStorage.getItem("sp.doctorName") || "" },
  });
}

/** Share session loading between the scene list and play page to avoid redirecting before hydration completes. */
export function useSceneContext() {
  const snapshot = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  const context = useMemo(() => snapshot ? JSON.parse(snapshot) : null, [snapshot]);
  return {
    ready: snapshot !== null,
    context: context?.user.name && context?.doctor.name ? context : null,
  };
}
