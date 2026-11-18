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
        <h1>{t("A note about privacy")}</h1>
        <p>
          {t(
            "This local demo stores the name, email address, password hash and display settings of the adult. If you create a child profile, it also stores a nickname, broad age range, favorite interest, favorite color, optional communication-passport notes, generated stories, and any reflection-journal entries you write. These records are kept in a local SQLite database on this computer. Children do not create accounts.",
          )}
        </p>
        <p>
          {t(
            "Use nicknames and general descriptions, not full names or sensitive details. Before launch, add a complete privacy policy, deletion and retention controls, secure hosting, and any required parental consent and legal review.",
          )}
        </p>
      </main>
    </PortalShell>
  );
}
