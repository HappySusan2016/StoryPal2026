"use client";
import Link from "next/link";
import PortalShell from "../components/PortalShell";
import { useTranslation } from "../hooks/useTranslation";

/** @module Policy placeholder page */
export default function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <PortalShell>
      <main className="plain">
        <Link className="back" href="/">
          ← {t("Back")}
        </Link>
        <article lang="en" className="space-y-4">
          <h1>StoryPal Privacy Note</h1>
          <p>
            This Privacy Note explains how StoryPal handles information and forms part of the{" "}
            <Link href="/terms" className="underline">StoryPal Terms of Use</Link>.
          </p>

          <h2 className="pt-4 text-xl font-semibold">Information We Collect</h2>
          <p>
            We collect the adult account holder&apos;s name and email address to manage the account.
            We store the child profiles, stories, communication notes, and reflections you choose to
            save. We also collect usage information, such as pages visited and time spent on them,
            and store preferences and cached records in your browser.
          </p>

          <h2 className="pt-4 text-xl font-semibold">Children&apos;s Information</h2>
          <p>
            Only adults create accounts and provide information. Use a nickname, a broad age range,
            an interest, and a brief, general description of the situation. Keep communication notes
            to general cues. Do not enter full names, birth dates, addresses, school names, photos,
            diagnoses, medical records, or other sensitive or identifying details about a child.
          </p>

          <h2 className="pt-4 text-xl font-semibold">How We Use Information</h2>
          <p>
            We use information to operate accounts, create and save stories, and improve StoryPal.
            We use Firebase for sign-in and cloud storage. When you use AI-assisted story features,
            we send relevant story inputs to Google Gemini to generate text.
          </p>

          <h2 className="pt-4 text-xl font-semibold">Research</h2>
          <p>
            We may analyze anonymized, aggregated usage data to improve StoryPal. Using StoryPal
            does not enroll you or your child in a study. Research involving identifiable
            information requires separate informed consent under a protocol approved by an
            Institutional Review Board (IRB).
          </p>

          <h2 className="pt-4 text-xl font-semibold">Deletion and Contact</h2>
          <p>
            You can delete profiles and stories within StoryPal. For account deletion requests or
            privacy questions, email the StoryPal team at{" "}
            <a href="mailto:storypal.family@gmail.com" className="underline">
              storypal.family@gmail.com
            </a>.
          </p>
        </article>
      </main>
    </PortalShell>
  );
}
