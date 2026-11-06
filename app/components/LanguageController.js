"use client";

import { useEffect } from "react";

export default function LanguageController() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "sp.siteLanguage";
    
    const apply = (val) => {
      const v = val || "en";
      
      // Set the lang attribute on html element
      document.documentElement.setAttribute("lang", v);
    };
    
    apply(window.localStorage.getItem(key) || "en");
    
    // Listen to storage events (cross-tab)
    const onStorage = (e) => {
      if (e.key === key) apply(e.newValue);
    };
    
    // Listen to custom event (same tab)
    const onLanguageChange = (e) => {
      apply(e.detail);
    };
    
    window.addEventListener("storage", onStorage);
    window.addEventListener("languagechange", onLanguageChange);
    
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("languagechange", onLanguageChange);
    };
  }, []);
  return null;
}

