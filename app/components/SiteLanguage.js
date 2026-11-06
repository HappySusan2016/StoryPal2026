"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
];

export default function SiteLanguage() {
  const [pendingLanguage, setPendingLanguage] = useState("en");
  const [languageAppliedAt, setLanguageAppliedAt] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("sp.siteLanguage") || "en";
      setPendingLanguage(saved);
    }
  }, []);

  const handleApplyLanguage = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sp.siteLanguage", pendingLanguage);
      document.documentElement.setAttribute("lang", pendingLanguage);
      window.dispatchEvent(
        new CustomEvent("languagechange", { detail: pendingLanguage })
      );
      setLanguageAppliedAt(Date.now());
      // Force a page reload to apply translations
      window.location.reload();
    }
  };

  return (
    <section className="mt-6 rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">{t("siteLanguage")}</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        {t("chooseLanguage")}
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        {LANGUAGES.map((lang) => (
          <label key={lang.code} className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="siteLanguage"
              checked={pendingLanguage === lang.code}
              onChange={() => setPendingLanguage(lang.code)}
            />
            <span className="text-sm">
              {lang.name} ({lang.nativeName})
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleApplyLanguage}
          className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3]"
        >
          {t("applyLanguage")}
        </button>
        {languageAppliedAt ? (
          <span className="text-sm text-emerald-700">{t("applied")}</span>
        ) : null}
      </div>
      <div className="mt-4 rounded-xl border border-zinc-200 p-4 bg-white">
        <div className="text-sm text-zinc-500 mb-2">{t("preview")}</div>
        <div className="text-lg text-zinc-900">
          {pendingLanguage === "en" && "Welcome to StoryPal"}
          {pendingLanguage === "es" && "Bienvenido a StoryPal"}
          {pendingLanguage === "pt" && "Bem-vindo ao StoryPal"}
          {pendingLanguage === "bn" && "স্টোরিপালে স্বাগতম"}
          {pendingLanguage === "zh" && "欢迎使用 StoryPal"}
        </div>
      </div>
    </section>
  );
}

