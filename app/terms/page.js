"use client";
import Link from "next/link";
import PortalShell from "../components/PortalShell";
import { useTranslation } from "../hooks/useTranslation";
/** @module Policy placeholder page */
export default function PolicyPage() {
  const { t } = useTranslation();
  return (
    <PortalShell>
      <main className="plain">
        <Link className="back" href="/">
          ← {t("Back")}
        </Link>
        <h1>{t("StoryPal terms")}</h1>
        <p>
          {t(
            "This demo is provided for evaluation. An adult must create and manage each account and supervise any child using the service.",
          )}
        </p>
        <p>
          {t(
            "Do not upload private, sensitive, or identifying information about a child. Before public launch, replace this page with reviewed terms for your service.",
          )}
        </p>
      </main>
    </PortalShell>
  );
}
