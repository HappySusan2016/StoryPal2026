"use client";

import SiteFont from "../components/SiteFont";
import SiteLanguage from "../components/SiteLanguage";
import { useTranslation } from "../hooks/useTranslation";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-semibold text-zinc-900">
          {t("settingsTitle")}
        </h1>
        <p className="mt-2 text-zinc-600">{t("settingsDescription")}</p>

        <div className="mt-6">
          <SiteFont />
          <SiteLanguage />
        </div>
      </div>
    </main>
  );
}


