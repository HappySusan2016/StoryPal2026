"use client";

import { useTranslation } from "../hooks/useTranslation";
import Link from "next/link";

export default function NavLinks() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/" className="text-[#315e4a] hover:underline">{t("Home")}</Link>
      <Link href="/onboarding" className="text-[#315e4a] hover:underline">{t("Onboarding")}</Link>
      <Link href="/scenes" className="text-[#315e4a] hover:underline">{t("Scenes")}</Link>
      <Link href="/parent" className="text-[#315e4a] hover:underline">{t("Parent Portal")}</Link>
      <Link href="/child" className="text-[#315e4a] hover:underline">{t("Child Portal")}</Link>
    </div>
  );
}


