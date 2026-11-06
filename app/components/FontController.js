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
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fontchange", onFontChange);
    };
  }, []);
  return null;
}


