"use client";

import { useState, useEffect } from "react";
import { translations } from "../lib/translations";

export function useTranslation() {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("sp.siteLanguage") || "en";
      queueMicrotask(() => setLanguage(saved));

      // Listen for language changes
      const handleLanguageChange = (e) => {
        setLanguage(e.detail || saved);
      };

      const handleStorageChange = (e) => {
        if (e.key === "sp.siteLanguage") {
          setLanguage(e.newValue || "en");
        }
      };

      window.addEventListener("languagechange", handleLanguageChange);
      window.addEventListener("storage", handleStorageChange);

      return () => {
        window.removeEventListener("languagechange", handleLanguageChange);
        window.removeEventListener("storage", handleStorageChange);
      };
    }
  }, []);

  /** @module Translation fallback and parameter interpolation */
  const t = (key, values = {}) => {
    const langTranslations = translations[language] || translations.en;
    const text = langTranslations[key] || translations.en[key] || key;
    return text.replace(
      /\{(\w+)\}|\$(\w+)/g,
      (match, braced, dollar) => values[braced || dollar] ?? match,
    );
  };

  return { t, language };
}
