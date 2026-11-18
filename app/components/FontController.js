"use client";

import { useEffect } from "react";

export default function FontController() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "sp.uiFont";
    
    const apply = (val) => {
      const v = val || "classic";
      
      // Set the data attribute
      document.documentElement.setAttribute("data-ui-font", v);
      
      // Apply inline style directly to body (same as preview)
      let fontFamily;
      if (v === "hand") {
        fontFamily = "var(--font-shadows-into-light)";
      } else if (v === "playful") {
        fontFamily = "var(--font-slackey)";
      } else {
        fontFamily = "var(--font-epilogue)";
      }
      
      document.body.style.fontFamily = fontFamily;
    };
    
    apply(window.localStorage.getItem(key) || "classic");
    
    // Override the legacy player's text size only after the user selects a reading size.
    const applyTextSize = () => document.documentElement.setAttribute("data-story-text-size", window.localStorage.getItem("sp.storyTextSize") || "normal");
    applyTextSize();
    window.addEventListener("storytextchange", applyTextSize);
    window.addEventListener("storage", applyTextSize);

    // Listen to storage events (cross-tab)
    const onStorage = (e) => {
      if (e.key === key) apply(e.newValue);
    };
    
    // Listen to custom event (same tab)
    const onFontChange = (e) => {
      apply(e.detail);
    };
    
    window.addEventListener("storage", onStorage);
    window.addEventListener("fontchange", onFontChange);
    
    return () => {
      window.removeEventListener("storytextchange", applyTextSize);
      window.removeEventListener("storage", applyTextSize);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fontchange", onFontChange);
    };
  }, []);
  return null;
}


