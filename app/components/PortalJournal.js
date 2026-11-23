"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { toMillis } from "../lib/portalData";
import { DEFAULT_MODULES, getDefaultStoryTemplate } from "../lib/defaultModules";

import DeleteConfirmDialog from "./DeleteConfirmDialog";
import SuccessMessage from "./SuccessMessage";

/** @module Reflection journal */
export default function PortalJournal({
  modules,
  reflections,
  onSave,
  onDelete,
}) {
  const { t, language } = useTranslation();
  const [editing, setEditing] = useState(null);
  // Group default storybooks by template ID and list custom storybooks by their own IDs.
  const storiesById = new Map(modules.map(story => [story.id, story]));
  const storyOptions = new Map();
  for (const story of modules) {
    const option = getDefaultStoryTemplate(story) || story;
    storyOptions.set(option.id, option);
  }
  const originalStory = storiesById.get(editing?.storyId);
  const editingStoryId = (originalStory && getDefaultStoryTemplate(originalStory)?.id)
    || editing?.storyId || "";

  function handleSave(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      id: editing?.id,
      // When editing an older entry, preserve its original storybook link unless the user changes it.
      storyId: editing && data.get("storyId") === editingStoryId
        ? editing.storyId
        : data.get("storyId"),
      childComfort: Number(data.get("childComfort")),
      parentConfidence: Number(data.get("parentConfidence")),
      observations: data.get("observations"),
      successMoments: data.get("successMoments"),
    });
    event.currentTarget.reset();
    setEditing(null);
  }
  /** @module Journal entry deletion confirmation and feedback */
  const deleteDialogRef = useRef(null);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [deletedEntryId, setDeletedEntryId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (deletedEntryId === null) return;
    const timeout = window.setTimeout(() => setDeletedEntryId(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [deletedEntryId]);

  function handleOpenDeleteDialog(id) {
    setDeleteError("");
    setEntryToDelete(id);
    deleteDialogRef.current.open();
  }

  function handleConfirmDelete() {
    if (entryToDelete === null) return;
    try {
      onDelete(entryToDelete);
    } catch {
      setDeleteError("Could not save changes. Please try again.");
      return;
    }
    if (editing?.id === entryToDelete) setEditing(null);
    setDeletedEntryId(entryToDelete);
    deleteDialogRef.current.close();
  }

  /** @module Journal ratings */
  function renderRating(name, label, low, high) {
    return (
      <fieldset className="rating-field">
        <legend>{t(label)}</legend>
        <div className="rating">
          {[1, 2, 3, 4, 5].map((score) => (
            <label className="rate" key={score}>
              <input
                type="radio"
                name={name}
                value={score}
                defaultChecked={score === (editing?.[name] ?? 3)}
                required
              />
              <span>{score}</span>
            </label>
          ))}
        </div>
        <div className="rating-scale">
          <span>{t(low)}</span>
          <span>{t(high)}</span>
        </div>
      </fieldset>
    );
  }
  return (
    <section className="card journal" id="journal">
      <SuccessMessage
        message={deletedEntryId !== null ? t("Reflection deleted successfully") : null}
      />
      <DeleteConfirmDialog
        ref={deleteDialogRef}
        title={t("Delete reflection")}
        description={t("You are about to delete data. Please confirm whether to continue.")}
        confirmLabel={t("Continue")}
        error={deleteError ? t(deleteError) : ""}
        onConfirm={handleConfirmDelete}
        onClose={() => setEntryToDelete(null)}
      />
      <div className="section-label">{t("FOR GROWN-UPS")}</div>
      <h2>{t("Reflection journal")}</h2>
      <p>
        {t(
          "After each story session, take a minute to note how it went. Over time this shows how comfort and confidence are growing.",
        )}
      </p>
      <div className="journal-grid">
        <div>
          {modules.length ? (
            <form
              key={editing?.id || "new"}
              className="journal-form"
              onSubmit={handleSave}
            >
              <label htmlFor="journal-story">
                {t("Which story did you practice?")}
              </label>
              <select
                id="journal-story"
                name="storyId"
                defaultValue={editingStoryId}
                required
              >
                <option value="">{t("Choose a story…")}</option>
                {editingStoryId && !storyOptions.has(editingStoryId) && (
                  <option value={editingStoryId}>
                    {DEFAULT_MODULES.find(story => story.id === editingStoryId)?.title || t("Story")}
                  </option>
                )}
                {Array.from(storyOptions.values()).map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title}
                  </option>
                ))}
              </select>
              <div className="rating-row">
                {renderRating(
                  "childComfort",
                  "Child's comfort level",
                  "very uneasy",
                  "fully at ease",
                )}
                {renderRating(
                  "parentConfidence",
                  "Your confidence level",
                  "unsure how to help",
                  "very confident",
                )}
              </div>
              <label htmlFor="observations">{t("What did you observe?")}</label>
              <textarea
                id="observations"
                name="observations"
                defaultValue={editing?.observations || ""}
                placeholder={t(
                  "Describe your child's reactions, engagement, behaviors...",
                )}
              />
              <label htmlFor="successMoments">{t("Success moments")}</label>
              <textarea
                id="successMoments"
                name="successMoments"
                defaultValue={editing?.successMoments || ""}
                placeholder={t(
                  "e.g. answered a question on page 3, used the calming cue without a reminder",
                )}
              />
              <button className="primary auto">
                {t("Save reflection")} <span>→</span>
              </button>
              {editing && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  {t("Cancel")}
                </button>
              )}
            </form>
          ) : (
            <p className="empty-state">
              {t(
                "Make a story first, then come back here after you read it together.",
              )}
            </p>
          )}
        </div>
        <div>
          <h3>{t("Past sessions")}</h3>
          {reflections.length ? (
            <>
              <div className="journal-stats">
                {[
                  [reflections.length, "Sessions logged"],
                  [
                    (
                      reflections.reduce(
                        (sum, r) => sum + Number(r.childComfort || 0),
                        0,
                      ) / reflections.length
                    ).toFixed(1),
                    "Avg. comfort",
                  ],
                  [
                    (
                      reflections.reduce(
                        (sum, r) => sum + Number(r.parentConfidence || 0),
                        0,
                      ) / reflections.length
                    ).toFixed(1),
                    "Avg. your confidence",
                  ],
                ].map(([value, label]) => (
                  <div className="stat" key={label}>
                    <b>{value}</b>
                    <span>{t(label)}</span>
                  </div>
                ))}
              </div>
              <ul className="entries">
                {reflections.map((entry) => (
                  <li className="entry" key={entry.id}>
                    <div className="entry-head">
                      <div>
                        <b>
                          {storiesById.get(entry.storyId)?.title ||
                            DEFAULT_MODULES.find(story => story.id === entry.storyId)?.title ||
                            t("Story")}
                        </b>
                        <span>
                          {toMillis(entry.createdAt)
                            ? new Date(
                                toMillis(entry.createdAt),
                              ).toLocaleDateString(language)
                            : ""}
                        </span>
                      </div>
                      <div className="entry-actions">
                        <button
                          className="link-btn"
                          onClick={() => setEditing(entry)}
                        >
                          {t("Edit")}
                        </button>{" "}
                        <button
                          className="link-btn"
                          onClick={() => handleOpenDeleteDialog(entry.id)}
                        >
                          {t("Delete")}
                        </button>
                      </div>
                    </div>
                    <div className="entry-scores">
                      {[
                        ["Comfort", entry.childComfort],
                        ["Your confidence", entry.parentConfidence],
                      ].map(([label, value]) => (
                        <span className="score" key={label}>
                          <span className="k">{t(label)}</span>
                          <span className="meter" aria-label={`${value}/5`}>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <i
                                key={score}
                                className={
                                  score <= Number(value) ? "on" : undefined
                                }
                              />
                            ))}
                          </span>
                          <span>{value}/5</span>
                        </span>
                      ))}
                    </div>
                    {entry.observations && (
                      <p>
                        <span className="k">{t("Observed")}</span>
                        {entry.observations}
                      </p>
                    )}
                    {entry.successMoments && (
                      <p>
                        <span className="k">{t("Success moments")}</span>
                        {entry.successMoments}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-state">
              {t(
                "No reflections yet. Your entries will appear here so you can see progress over time.",
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
