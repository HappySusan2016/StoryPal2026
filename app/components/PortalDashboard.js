"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { getNewestProfiles, toMillis } from "../lib/portalData";
import { getDefaultStoryTemplate } from "../lib/defaultModules";
import { subscribeToReadingPageCounts } from "../lib/readingSessions";
import { clearWorkshopChild, getWorkshopChild } from "../lib/workshopSelection";

import DeleteConfirmDialog from "./DeleteConfirmDialog";
import PassportFields from "./PassportFields";
import SuccessMessage from "./SuccessMessage";
import { hasDuplicateChildName, passportGroups, updatePassportFromForm } from "../lib/passportFields";

/** @module Parent dashboard and child profile details */
export default function PortalDashboard({
  initialProfileId = null,
  onSignOut,
  user,
  passports,
  modules,
  loading,
  loadError,
  onSavePassport,
  onDeletePassport,
  onCreate,
  onEdit,
  onDeleteStory,
  onTraining,
  journal,
}) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const profileId = initialProfileId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passportError, setPassportError] = useState("");
  const profile = passports.find((p) => p.id === profileId);

  const uid = user?.uid;

  /** @module Expanded child sections in the Story Workshop */
  const orderedPassports = profileId ? passports : getNewestProfiles(passports);
  const [returnChildId] = useState(() => profileId ? null : getWorkshopChild(uid));
  const [expansionByChild, setExpansionByChild] = useState(() => new Map());
  // Expand the child associated with a story being created or edited, or default to the first child in sorted order.
  const defaultExpandedChildId = orderedPassports.find(({ id }) => id === returnChildId)?.id
    ?? orderedPassports[0]?.id;

  useEffect(() => {
    if (!profileId) clearWorkshopChild(uid);
  }, [profileId, uid]);

  // Toggle each child's section independently.
  function isWorkshopChildExpanded(childId) {
    return expansionByChild.get(childId) ?? childId === defaultExpandedChildId;
  }

  function handleToggleWorkshopChild(childId) {
    setExpansionByChild((previous) => {
      const expanded = previous.get(childId) ?? childId === defaultExpandedChildId;
      return new Map(previous).set(childId, !expanded);
    });
  }

  /** @module Dashboard page counts aggregated across the current account's existing profiles */
  const [readingPageCounts, setReadingPageCounts] = useState(null);
  useEffect(() => {
    if (!uid || profileId) return;
    return subscribeToReadingPageCounts(
      uid,
      (counts) => setReadingPageCounts({ uid, counts }),
      (error) => {
        console.error("Failed to load reading page counts", error);
        setReadingPageCounts({ uid, counts: null });
      },
    );
  }, [uid, profileId]);
  const counts = readingPageCounts?.uid === uid ? readingPageCounts?.counts : null;
  const pagesRead = counts
    ? passports.reduce((total, passport) => total + (counts.get(passport.id) || 0), 0)
    : "—";

  /** @module Profile save feedback */
  const [savedProfile, setSavedProfile] = useState(null);
  useEffect(() => {
    if (!savedProfile) return;
    const timeout = window.setTimeout(() => setSavedProfile(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [savedProfile]);

  /** @module Profile and storybook actions */
  async function handleAction(action, reportError = setError) {
    setBusy(true);
    setError("");
    if (reportError !== setError) reportError("");
    try {
      await action();
      return true;
    } catch (error) {
      reportError(error?.code === "duplicate-child-name"
        ? "A child profile with this name already exists."
        : "Could not save changes. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function handleSave(event, existing) {
    event.preventDefault();
    const form = event.currentTarget;
    setSavedProfile(null);
    const data = new FormData(form);
    const next = updatePassportFromForm(existing, data, crypto.randomUUID());
    // Validate the name on the home page and the trimmed age in both forms.
    if (!existing && !next.childName) {
      setPassportError("Enter a child name.");
      return;
    }
    if (!next.age) {
      setPassportError("Enter an age.");
      return;
    }
    if (!existing && !/^[0-9]+$/.test(next.age)) {
      setPassportError("Enter digits only for age.");
      return;
    }
    // Require at least one visible communication method on the details page.
    if (existing && !data.has("modalities")) {
      setPassportError("Select at least one communication modality.");
      form.querySelector('input[name="modalities"]')?.focus();
      return;
    }
    // Check the loaded profile list first so the form can flag duplicate names immediately.
    if (hasDuplicateChildName(next, passports, existing)) {
      setPassportError("A child profile with this name already exists.");
      return;
    }
    return handleAction(async () => {
      await onSavePassport(next);
      if (!existing) {
        router.push(`/profiles/${next.id}`);
        return;
      }
      // Show the defaults saved successfully while retaining any input entered during the save.
      for (const [group, , fields] of passportGroups) {
        for (const [field] of fields) {
          const name = `${group}.${field}`;
          const input = form.elements.namedItem(name);
          const submitted = data.get(name);
          if (submitted !== null && !submitted.trim() && input?.value === submitted) {
            input.value = next[group][field];
          }
        }
      }
      // Collapse the form sections after a successful save while preserving the inputs and their values.
      form.querySelectorAll("details[open]").forEach((section) => {
        section.open = false;
      });
      setSavedProfile({ id: next.id });
    }, setPassportError);
  }
  function renderDetails(existing) {
    return (
      <>
        <PassportFields passport={existing} basicOnly={!existing} />
        {passportError && <p className="notice error" role="alert">{t(passportError)}</p>}
      </>
    );
  }

  /** @module Profile deletion success message */
  const [profileDeleted, setProfileDeleted] = useState(false);
  const profileDeletedKey = `sp.profileDeleted.${uid}`;

  useEffect(() => {
    if (!uid || profileId) return;
    let dismissTimeout;
    const showTimeout = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(profileDeletedKey) !== "1") return;
        // Show the message on the home page only once so it does not reappear after a refresh.
        sessionStorage.removeItem(profileDeletedKey);
      } catch {
        return;
      }
      setProfileDeleted(true);
      dismissTimeout = window.setTimeout(() => setProfileDeleted(false), 3000);
    }, 0);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(dismissTimeout);
    };
  }, [uid, profileId, profileDeletedKey]);

  /** @module Profile and storybook deletion confirmation */
  const deleteDialogRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const isProfileDeletion = deleteTarget?.type === "profile";

  function handleOpenDeleteDialog(target) {
    setError("");
    setDeleteTarget(target);
    deleteDialogRef.current.open();
  }

  function handleDeleteProfileSubmit(event) {
    event.preventDefault();
    if (!profile || busy || loading) return;
    handleOpenDeleteDialog({
      type: "profile",
      id: profile.id,
      name: profile.childName,
    });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || busy) return;
    const deleted = await handleAction(() =>
      isProfileDeletion
        ? onDeletePassport(deleteTarget.id)
        : onDeleteStory(deleteTarget.id),
    );
    if (!deleted) return;
    deleteDialogRef.current?.close();
    if (isProfileDeletion) {
      try {
        sessionStorage.setItem(profileDeletedKey, "1");
      } catch {
        // Return to the home page even if the browser blocks session storage.
      }
      router.replace("/");
    }
  }

  /** @module Storybook list */
  function renderStories(stories) {
    return stories.length ? (
      <ul className="story-list">
        {stories.map((story) => (
          <li key={story.id}>
            <span className="icon" aria-hidden="true">▶</span>
            <div className="meta">
              <strong className="story-title-button">{story.title}</strong>
              <span>
                {toMillis(story.createdAt)
                  ? new Date(toMillis(story.createdAt)).toLocaleDateString(language)
                  : ""}
              </span>
            </div>
            <div className="story-actions">
              {/* The home workshop only opens built-in storybooks for reading. */}
              {!getDefaultStoryTemplate(story) && <>
                <button className="secondary" type="button" onClick={() => onEdit(story)}>{t("Edit")}</button>
                <button
                  className="secondary danger"
                  type="button"
                  disabled={busy}
                  onClick={() => handleOpenDeleteDialog({ type: "story", id: story.id, name: story.title })}
                >{t("Delete")}</button>
              </>}
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="hint">{t("No stories yet. Make the first one above.")}</p>
    );
  }
  if (initialProfileId && loading)
    return (
      <main className="workspace" role="status">
        {t("Loading…")}
      </main>
    );
  if (initialProfileId && !profile)
    return (
      <main className="workspace">
        <p role="alert">{t("Profile not found.")}</p>
        <Link href="/">{t("← Back to your space")}</Link>
      </main>
    );

  return (
    <main className={profile ? "workspace" : "dashboard"}>
      {!profileId && (
        <SuccessMessage message={profileDeleted ? t("Profile deleted successfully") : null} />
      )}
      {loadError && (
        <p className="notice error" role="alert">
          {t(loadError)}
        </p>
      )}
      {error && !deleteTarget && (
        <p role="alert" className="notice">
          {t(error)}
        </p>
      )}
      <DeleteConfirmDialog
        ref={deleteDialogRef}
        title={isProfileDeletion ? t("Delete this profile") : t("Delete this story?")}
        itemName={deleteTarget?.name}
        description={
          isProfileDeletion
            ? t("You are about to delete data. Please confirm whether to continue.")
            : t("Delete this story permanently.")
        }
        confirmLabel={isProfileDeletion ? t("Continue") : t("Delete")}
        busy={busy}
        error={error && deleteTarget ? t(error) : ""}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setError("");
          setDeleteTarget(null);
        }}
      />
      {profile ? (
        <>
          <Link className="back profile-back" href="/">
            {t("← Back to your space")}
          </Link>
          <div className="page-head profile-page-head">
            <div className="profile-head">

              <div>
                <div className="section-label">{t("PROFILE")}</div>
                <h1>{profile.childName}</h1>
                <p>
                  {profile.age || ""} · {profile.interaction?.interests || ""}

                </p>
              </div>
            </div>
            <div className="actions">
              <button
                className="primary auto"
                onClick={() => onCreate(profile.id)}
              >
                {t("Make a story")} <span>→</span>
              </button>
              <Link className="secondary" href="/child">
                ▶ {t("Child mode")}
              </Link>
            </div>
          </div>
          <section className="card">
            <SuccessMessage message={savedProfile?.id === profile.id ? t("Changes saved successfully") : null} />
            <div className="section-label">{t("COMMUNICATION PASSPORT")}</div>
            <h2>{t("Update details")}</h2>
            <form className="profile-details-form passport-fields" key={profile.id} onSubmit={e => handleSave(e, profile)} onInput={() => setPassportError("")}>
              {renderDetails(profile)}
              <button className="primary" disabled={busy || loading}>{t("Save changes")}</button>
            </form>
          </section>
          <section className="card danger-zone" style={{ marginTop: 22 }}>
            <div className="section-label">{t("REMOVE PROFILE")}</div>
            <h2>{t("Delete this profile")}</h2>
            <p>
              {t(
                "The profile will be removed. Its stories will be kept without a profile.",
              )}
            </p>
            <form onSubmit={handleDeleteProfileSubmit}>
              <label className="check">
                <input type="checkbox" required />
                <span>{t("I understand this removes the profile.")}</span>
              </label>
              <button className="secondary danger" disabled={busy || loading}>
                {t("Delete profile")}
              </button>
            </form>
          </section>
        </>
      ) : (
        <>
          <div className="page-head">
            <div>
              <div className="eyebrow">
                <span />
                {t("YOUR GROWN-UP SPACE")}
              </div>
              <h1>
                {t("Welcome, $first_name", {
                  first_name: user.displayName?.split(" ")[0] || "",
                })}{" "}
                <em>♡</em>
              </h1>
              <p className="lede">
                {t(
                  "Create a simple profile, then make a gentle story for a moment your child is learning to navigate.",
                )}
              </p>
            </div>
            <div className="actions">
              <Link className="secondary" href="/child">
                ▶ {t("Open child mode")}
              </Link>
            </div>
          </div>
          <section className="stats" aria-labelledby="journey-title">
            <div className="section-head dashboard-module-head">
              <h2 id="journey-title">{t("Our Journey")}</h2>
              <Link className="secondary journey-more" href="/analytics" data-telemetry="dashboard_analytics_open" aria-label={t("View analytics")}>
                {t("More")} <span aria-hidden="true">↗</span>
              </Link>
            </div>
            {[
              [passports.length, "Profiles"],
              [modules.length, "Stories"],
              [
                modules.filter(
                  (m) => toMillis(m.createdAt) >= Date.now() - 7 * 86400000,
                ).length,
                "Made this week",
              ],
              [pagesRead, "Pages read together"],
            ].map(([count, label]) => (
              <div className="stat" key={label}>
                <b>{count}</b>
                <span>{t(label)}</span>
              </div>
            ))}
          </section>
          <section className="workspace-grid" aria-labelledby="guide-title">
            <div className="section-head dashboard-module-head"><h2 id="guide-title">{t("Guide")}</h2></div>
            <div className="profile-form-card">
              <div className="section-label">{t("STEP 1 · ADD A PROFILE")}</div>
              <h2>{t("Who is this story for?")}</h2>
              <p>
                {t(
                  "Create a communication passport to personalize stories for your child.",
                )}
              </p>
              <form
                onInput={() => setPassportError("")}
                onSubmit={async (e) => {
                  await handleSave(e);
                }}
              >
                {renderDetails()}
                <button className="primary" disabled={busy || loading}>
                  {t("Save child profile")} <span>→</span>
                </button>
              </form>
              <p className="hint">
                {t(
                  "You can add communication notes and calming cues on the profile page afterwards.",
                )}
              </p>
            </div>
            <div className="profiles-section">
              <div className="section-head">
                <div>
                  <div className="section-label">
                    {t("STEP 2 · MAKE A STORY")}
                  </div>
                  <h2>{t("Story workshop")}</h2>
                </div>
              </div>
              <p className="section-intro">
                {t(
                  "Choose a profile and enter a story title. Set up your story, generate it with AI, then edit each page.",
                )}
              </p>
              {loading ? (
                <p role="status">{t("Loading…")}</p>
              ) : (
                orderedPassports.map((p) => (
                  <article className="profile-card" key={p.id}>
                    <div className="profile-head">

                      <div>
                        <h3>
                          <Link href={`/profiles/${p.id}`}>{p.childName}</Link>
                        </h3>
                        <p>
                          {p.age || ""}
                        </p>
                      </div>
                      <div className="spacer">
                        <button
                          className="secondary"
                          onClick={() => router.push(`/profiles/${p.id}`)}
                        >
                          {t("Profile")}
                        </button>
                      </div>
                    </div>
                    <form
                      className="story-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const title = new FormData(e.currentTarget).get("moment").trim();
                        if (title) onCreate(p.id, title);
                      }}
                    >
                      <label htmlFor={`moment-${p.id}`}>
                        {t("Story title")}
                      </label>
                      <input
                        id={`moment-${p.id}`}
                        name="moment"
                        maxLength={160}
                        placeholder={t("e.g. getting ready for school")}
                        required
                      />
                      <button className="primary">
                        {t("Make a little story")} <span>→</span>
                      </button>
                    </form>
                    <button
                      className="secondary workshop-stories-toggle"
                      type="button"
                      aria-expanded={isWorkshopChildExpanded(p.id)}
                      aria-controls={`workshop-stories-${p.id}`}
                      aria-label={`${t("Stories")} · ${p.childName}`}
                      onClick={() => handleToggleWorkshopChild(p.id)}
                    >
                      {t("Stories")} <span aria-hidden="true">{isWorkshopChildExpanded(p.id) ? "▾" : "▸"}</span>
                    </button>
                    <div id={`workshop-stories-${p.id}`} hidden={!isWorkshopChildExpanded(p.id)}>
                      {renderStories(modules.filter((m) => m.childId === p.id))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
          <section className="card" style={{ marginTop: 22 }}>
            <h2>{t("Interactive Parent Training")}</h2>
            <p>
              {t("Learn the science behind StoryPal and how to use Co-Action.")}
            </p>
            <button className="secondary" onClick={onTraining}>
              {t("Start training")}
            </button>
          </section>
          <div className="portal-journal">{journal}</div>
          <div className="logout-form">
            <button className="secondary" onClick={onSignOut}>
              {t("Sign out")}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
