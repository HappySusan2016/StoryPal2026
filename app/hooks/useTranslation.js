"use client";

import { useState, useEffect } from "react";
import { translations } from "../lib/translations";

export function useTranslation() {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("sp.siteLanguage") || "en";
      setLanguage(saved);
      
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

  const t = (key) => {
    const langTranslations = translations[language] || translations.en;
    return langTranslations[key] || key;
  };

  return { t, language };
}

