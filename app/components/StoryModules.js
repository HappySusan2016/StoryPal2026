"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { auth } from "../lib/firebaseClient";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Sparkles, X } from "lucide-react";
import StoryPlayer, { interpolateStoryText } from "./StoryPlayer";
import StoryTextField from "./StoryTextField";
import { hasManualParentGuide, isValidParentGuide } from "../lib/parentGuides";
import { getStoryGoalDisplayText, getStorySetup, storyStages } from "../lib/storyWorkshop";
import { encodeStoryImage, storyDraftByteLimit, storyImageAccept } from "../lib/storyEditorImage";
import { useTranslation } from "../hooks/useTranslation";

function createEmptyStep(stepType) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (stepType === "doctor") {
    return { id, type: "doctor", message: "", imageUrl: "" };
  }
  if (stepType === "user-input") {
    return {
      id,
      type: "user-input",
      message: "",
      placeholder: "",
      imageUrl: "",
    };
  }
  return { id, type: "choice", message: "", options: [""], imageUrl: "" };
}

function getStepTypeLabel(stepType) {
  if (stepType === "doctor") return "Message for children";
  if (stepType === "user-input") return "Child's input";
  if (stepType === "choice") return "Multiple choice";
  return stepType;
}

function ensureStepIds(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, idx) => {
    if (!step.id) {
      return {
        ...step,
        id: `step_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      };
    }
    return step;
  });
}

function validateModule(moduleDef) {
  if (!moduleDef.title.trim()) return false;
  if (!Array.isArray(moduleDef.steps) || moduleDef.steps.length === 0)
    return false;
  for (const step of moduleDef.steps) {
    if (step.type === "doctor" && !step.message.trim()) return false;
    if (step.type === "user-input" && !step.message.trim()) return false;
    if (step.type === "choice") {
      if (!step.message.trim()) return false;
      if (!Array.isArray(step.options) || step.options.length === 0)
        return false;
      if (step.options.some((o) => !o.trim())) return false;
    }
  }
  return true;
}

/** @module Story editor defaults and draft structure */
const defaultCover = "/default-story-cover.svg";

function getEditorDraft(story, steps) {
  return {
    title: story?.title || "",
    coverImage: story?.coverImage || "",
    childId: story?.childId || "",
    steps,
    stageDesign: story?.stageDesign ?? null,
  };
}

/** @module Shared upload handler for covers and illustrations */
function StoryImageUpload({ src, alt, cover = false, disabled, onUpload }) {
  const { t } = useTranslation();
  return (
    <div className="story-image-frame" data-filled={Boolean(src)}>
      {src && <Image src={src} alt={alt} fill sizes={cover ? "(max-width: 640px) 100vw, 240px" : "(max-width: 640px) 100vw, 320px"}
        unoptimized />}
      <label className="story-editor-button story-image-upload" aria-disabled={disabled || undefined}>
        {src ? <Pencil size={16} aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
        {t(src ? "Replace image" : "Upload Image")}
        <input type="file" accept={storyImageAccept} className="sr-only" disabled={disabled}
          aria-label={t(cover ? "Replace cover image" : src ? "Replace illustration" : "Upload illustration")}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onUpload(file);
          }} />
      </label>
    </div>
  );
}

export default function StoryModules({
  passport,
  onSave,
  getTemplateContext,
  initialData,
  isNewDraft = false,
  unsavedEdits,
  draftStorageKey,
  saving = false,
  generationInput,
}) {
  const { t } = useTranslation();
  /** @module Initial draft and editor state */
  const initialStepsRef = useRef(null);
  if (initialStepsRef.current === null) {
    initialStepsRef.current = ensureStepIds(initialData?.steps || []);
  }
  const [savedDraft] = useState(() => getEditorDraft(initialData, initialStepsRef.current));
  const initialDraft = unsavedEdits || savedDraft;
  const [title, setTitle] = useState(initialDraft.title);
  const [view, setView] = useState("edit");
  const [newType, setNewType] = useState("doctor");
  const [newStage, setNewStage] = useState("immersion");
  const [coverImage, setCoverImage] = useState(initialDraft.coverImage);
  const childId = passport?.id || savedDraft.childId;
  const stageDesign = initialDraft.stageDesign ?? savedDraft.stageDesign;
  const [steps, setSteps] = useState(initialDraft.steps);
  const editingId = initialData?.id || null;
  const isUpdating = Boolean(editingId && !isNewDraft);
  const sceneFont = initialData?.fontPreset || "classic";

  /** @module Restore unsaved edits in the current tab */
  const draftSnapshot = JSON.stringify({
    title, coverImage, childId, steps, stageDesign,
  });
  const savedSnapshot = JSON.stringify(savedDraft);
  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      if (draftSnapshot === savedSnapshot) sessionStorage.removeItem(draftStorageKey);
      else sessionStorage.setItem(draftStorageKey, draftSnapshot);
    } catch {
      // The editor can still save to the cloud if session storage is unavailable.
    }
  }, [draftStorageKey, draftSnapshot, savedSnapshot]);

  /** @module Story page management */
  const deletedStepsByType = useRef(new Map());

  function handleAddStep() {
    // Restore the most recently deleted page of the same type, consuming each saved page only once.
    const restoredStep = deletedStepsByType.current.get(newType)?.pop();
    const step = { ...(restoredStep ?? createEmptyStep(newType)), stage: newStage };
    if (!restoredStep && step.type === "choice") step.options = ["", ""];
    setSteps((prev) => [...prev, step]);
  }

  function handleDeleteStep(step) {
    // Keep only pages with entered or generated content so blank pages cannot replace earlier deleted pages.
    const content = [
      step.message, step.placeholder, step.imageUrl, step.imageDescription,
      ...(step.options ?? []), ...(step.optionImageDescriptions ?? []),
      step.parentGuide?.title, step.parentGuide?.description, step.parentGuide?.coActionPrompt,
    ];
    if (content.some((value) => typeof value === "string" && value.trim())) {
      const deletedSteps = deletedStepsByType.current.get(step.type) ?? [];
      deletedSteps.push(step);
      deletedStepsByType.current.set(step.type, deletedSteps);
    }
    setSteps((prev) => prev.filter((s) => s.id !== step.id));
  }

  function moveStep(stepId, direction) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function updateStep(stepId, field, value) {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s))
    );
  }

  /** @module Sync choices with their illustration descriptions */
  function updateChoiceOption(stepId, optionIndex, value) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const options = Array.isArray(s.options) ? [...s.options] : [];
        if (options[optionIndex] === value) return s;
        options[optionIndex] = value;
        const optionImageDescriptions = s.optionImageDescriptions?.map((description, index) =>
          index === optionIndex ? "" : description);
        return { ...s, options, ...(optionImageDescriptions && { optionImageDescriptions }) };
      })
    );
  }

  function addChoiceOption(stepId) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const options = Array.isArray(s.options) ? [...s.options, ""] : [""];
        const optionImageDescriptions = s.optionImageDescriptions && [...s.optionImageDescriptions, ""];
        return { ...s, options, ...(optionImageDescriptions && { optionImageDescriptions }) };
      })
    );
  }

  function removeChoiceOption(stepId, optionIndex) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const options = (Array.isArray(s.options) ? s.options : []).filter(
          (_, i) => i !== optionIndex
        );
        const optionImageDescriptions = s.optionImageDescriptions?.filter((_, i) => i !== optionIndex);
        return { ...s, options, ...(optionImageDescriptions && { optionImageDescriptions }) };
      })
    );
  }

  /** @module Story preview and save validation */
  const resolvedCoverImage = coverImage.trim() || defaultCover;
  const previewStory = {
    id: editingId || "preview",
    title: title.trim() || t("Untitled Story"),
    coverImage: resolvedCoverImage,
    steps,
    fontPreset: sceneFont,
  };
  const templateContext = getTemplateContext(passport);
  const setup = generationInput && getStorySetup(passport, generationInput.picks, generationInput.custom);
  const changed = draftSnapshot !== savedSnapshot;
  const initialById = new Map(initialStepsRef.current.map((step) => [step.id, step]));
  const hasIncompleteGuide = steps.some((step) => hasManualParentGuide(step, initialById.get(step.id))
    && !isValidParentGuide(step.parentGuide));
  const exceedsBudget = draftSnapshot.length * 3 > storyDraftByteLimit
    && new Blob([draftSnapshot]).size > Math.max(storyDraftByteLimit, new Blob([savedSnapshot]).size);
  const isValid = validateModule({ title, steps }) && !hasIncompleteGuide && !exceedsBudget;

  /** @module Shared compression for uploads and generation, with concurrent replacements and submissions blocked during processing */
  const imageJobRef = useRef(null);
  const [imageJob, setImageJob] = useState(null);
  const [imageError, setImageError] = useState(null);

  async function handleImageChange(stepId, loadImage, generating = false) {
    if (imageJobRef.current || saving) return;
    const job = { stepId, generating };
    imageJobRef.current = job;
    setImageJob(job);
    setImageError(null);
    try {
      const image = await encodeStoryImage(await loadImage(), { cropToCoverRatio: generating });
      if (stepId) updateStep(stepId, "imageUrl", image);
      else setCoverImage(image);
    } catch (error) {
      const message = error.name === "TimeoutError" ? "Image generation timed out. Please try again."
        : error instanceof TypeError || error instanceof DOMException
          ? "Could not prepare this image. Please try again."
          : error.message;
      setImageError({ stepId, message });
    } finally {
      imageJobRef.current = null;
      setImageJob(null);
    }
  }

  function handleGenerateImage(stepId, input) {
    handleImageChange(stepId, async () => {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again.");
      const token = await user.getIdToken();
      const response = await fetch("/api/generate-story-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...input, childId: childId || null }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "AI could not generate an illustration. Please try again.");
      }
      return response.blob();
    }, true);
  }

  function handleGenerateCover() {
    const descriptions = steps.map((step) => step.imageDescription?.trim() || step.message?.trim()).filter(Boolean);
    const descriptionLimit = Math.floor(16000 / Math.max(descriptions.length, 1));
    handleGenerateImage(null, {
      cover: { title: title.trim(), descriptions: descriptions.map((description) => description.slice(0, descriptionLimit)) },
    });
  }

  function renderImageFeedback(stepId) {
    if (imageError?.stepId === stepId) return <p role="alert" className="story-image-error">{t(imageError.message)}</p>;
    if (imageJob?.stepId === stepId) {
      const status = stepId ? "Generating illustration…" : "Generating cover…";
      return <p role="status" className="story-image-status">{t(imageJob.generating ? status : "Preparing image…")}</p>;
    }
    return null;
  }

  /** @module Parent guides and saving */
  function handleGuideChange(stepId, field, value) {
    setSteps((current) => current.map((step) => step.id === stepId
      ? { ...step, parentGuide: { ...step.parentGuide, [field]: value } } : step));
  }

  const handleSave = () => {
    const moduleDefinition = {
      id: editingId || `${Date.now()}`,
      title: title.trim(),
      coverImage: resolvedCoverImage,
      steps,
      childId: childId || null,
      stageDesign,
      fontPreset: sceneFont || "classic",
    };
    if (!isValid || imageJobRef.current) return;
    onSave(moduleDefinition);
  };

  /** @module Story summary, page editing, and read-through */
  return (
    <section className="story-preview-workspace" aria-busy={saving}>
      <fieldset disabled={saving} inert={saving} className="story-preview-workspace">
        <header className="story-editor-card story-preview-header">
          <div className="story-preview-toolbar">
            <h1>{t("Story preview")}</h1>
            <div className="story-preview-switch" role="group" aria-label={t("Story preview")}>
              <button type="button" aria-pressed={view === "edit"} onClick={() => setView("edit")}>{t("Edit")}</button>
              <button type="button" aria-pressed={view === "read"} onClick={() => setView("read")}>{t("Read-through")}</button>
            </div>
          </div>
          <StoryTextField className="story-preview-title" label={t("Story title")} value={title}
            onValueChange={setTitle} context={templateContext} placeholder={t("Untitled Story")} />
          <div className="story-preview-meta">
            {setup && ["SCENARIO", "FOCUS", "TONE"].map((field) =>
              setup.values[field] && <span key={field}>{interpolateStoryText(t(setup.values[field]), templateContext)}</span>)}
            <span>{t("{count} pages", { count: steps.length })}</span>
          </div>
          {setup?.values.PARENT_GOAL && (
            <p className="story-preview-goal"><strong>{t("Parent goal")}</strong> · {interpolateStoryText(getStoryGoalDisplayText(setup, t), templateContext)}</p>
          )}
          {/* Place the cover in a separate section after the prototype's story summary. */}
          <div className="story-preview-cover-edit">
            <StoryImageUpload src={resolvedCoverImage} alt={t("Story cover")} cover disabled={Boolean(imageJob)}
              onUpload={(file) => handleImageChange(null, () => file)} />
            <p className="story-preview-cover-hint">{t("Recommended cover size: 1500 × 1000 px (3:2).")}</p>
            <button type="button" className="story-editor-button story-image-generate"
              disabled={Boolean(imageJob) || saving || !title.trim()} onClick={handleGenerateCover}>
              <Sparkles size={16} aria-hidden="true" />
              {t("Generate cover with AI")}
            </button>
            {renderImageFeedback(null)}
          </div>
        </header>

        <div hidden={view !== "read"}>
          <StoryPlayer layout="preview" moduleDefinition={previewStory} templateContext={templateContext} />
        </div>

        <div hidden={view !== "edit"} className="story-preview-workspace">
          <ol className="story-preview-workspace">
            {steps.map((step, index) => {
              const original = initialById.get(step.id);
              const edited = !original || JSON.stringify(original) !== JSON.stringify(step);
              const pageLabel = t("Page {page}", { page: index + 1 });
              const words = step.message?.match(/\S+/g)?.length || 0;
              const limit = setup?.values.MAX_WORDS_PER_PAGE;
              const choiceLimit = setup?.values.MAX_CHOICES;
              return (
                <li key={step.id} className="story-preview-page" data-edited={edited} data-stage={step.stage}>
                  <div className="story-preview-toolbar story-preview-page-bar">
                    <div className="story-preview-meta">
                      <strong>{pageLabel}</strong>
                      {step.stage && <span className="story-preview-stage-label">{t(step.stage[0].toUpperCase() + step.stage.slice(1))}</span>}
                      <span>{t(getStepTypeLabel(step.type))}</span>
                      {edited && <span className="story-preview-edited">{t("Edited")}</span>}
                    </div>
                    <div className="story-preview-toolbar">
                      <button type="button" className="story-editor-button is-icon" disabled={index === 0}
                        aria-label={t("Move up")} onClick={() => moveStep(step.id, "up")}><ArrowUp size={16} aria-hidden="true" /></button>
                      <button type="button" className="story-editor-button is-icon" disabled={index === steps.length - 1}
                        aria-label={t("Move down")} onClick={() => moveStep(step.id, "down")}><ArrowDown size={16} aria-hidden="true" /></button>
                      {edited && original && <button type="button" className="story-editor-button" disabled={imageJob?.stepId === step.id}
                        onClick={() => setSteps((current) => current.map((item) => item.id === step.id ? original : item))}>{t("Undo edits")}</button>}
                      <button type="button" className="story-editor-button is-danger" disabled={imageJob?.stepId === step.id}
                        onClick={() => handleDeleteStep(step)}>{t("Delete")}</button>
                    </div>
                  </div>
                  <div className="story-preview-page-body">
                    <div className="story-preview-picture">
                      <StoryImageUpload src={step.imageUrl} alt={t("Step preview")} disabled={Boolean(imageJob)}
                        onUpload={(file) => handleImageChange(step.id, () => file)} />
                      <StoryTextField label={t("Illustration description")} value={step.imageDescription} rows={3}
                        context={templateContext} onValueChange={(value) => updateStep(step.id, "imageDescription", value)} />
                      {renderImageFeedback(step.id)}
                      <button type="button" className="story-editor-button story-image-generate"
                        disabled={Boolean(imageJob) || !step.imageDescription?.trim()}
                        onClick={() => handleGenerateImage(step.id, { description: step.imageDescription })}>
                        <Sparkles size={16} aria-hidden="true" />
                        {t("Generate illustration with AI")}
                      </button>
                    </div>
                    <div className="story-preview-copy">
                      <StoryTextField label={t("Message")} value={step.message} rows={3}
                        context={templateContext} onValueChange={(value) => updateStep(step.id, "message", value)} />
                      {limit && <p className="story-preview-word-count" data-over={words > limit}>
                        {t("{count} / {limit} words", { count: words, limit })}
                      </p>}
                      {step.type === "user-input" && <StoryTextField label={t("Example answer shown to the child")} value={step.placeholder}
                        context={templateContext} onValueChange={(value) => updateStep(step.id, "placeholder", value)} />}
                      {step.type === "choice" && (
                        <div className="story-preview-options">
                          {step.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="story-preview-option">
                              <StoryTextField label={t("Choice {number}", { number: optionIndex + 1 })} value={option}
                                context={templateContext} onValueChange={(value) => updateChoiceOption(step.id, optionIndex, value)} />
                              <button type="button" className="story-editor-button is-danger is-icon" disabled={step.options.length <= 1}
                                aria-label={t("Remove choice {number}", { number: optionIndex + 1 })}
                                onClick={() => removeChoiceOption(step.id, optionIndex)}><X size={16} aria-hidden="true" /></button>
                              {step.optionImageDescriptions?.[optionIndex] && <p>{interpolateStoryText(step.optionImageDescriptions[optionIndex], templateContext)}</p>}
                            </div>
                          ))}
                          <button type="button" className="story-editor-button" disabled={Boolean(choiceLimit && step.options.length >= choiceLimit)}
                            onClick={() => addChoiceOption(step.id)}>{t("Add choice")}</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="story-preview-guide">
                    <h2>{t("Parent Guide")}</h2>
                    {[
                      ["title", "Guide title", undefined],
                      ["description", "Guide description", 2],
                      ["coActionPrompt", "Co-Action Prompt", 2],
                    ].map(([field, label, rows]) => (
                      <StoryTextField key={field} label={t(label)} rows={rows} context={templateContext}
                        value={step.parentGuide?.[field]} onValueChange={(value) => handleGuideChange(step.id, field, value)} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="story-editor-card story-preview-add">
            <label htmlFor="new-page-type">{t("Page type")}</label>
            <select id="new-page-type" className="story-preview-field" value={newType} onChange={(event) => setNewType(event.target.value)}>
              {["doctor", "choice", "user-input"].map((type) => <option key={type} value={type}>{t(getStepTypeLabel(type))}</option>)}
            </select>
            <label htmlFor="new-page-stage">{t("Stage")}</label>
            <select id="new-page-stage" className="story-preview-field" value={newStage} onChange={(event) => setNewStage(event.target.value)}>
              {storyStages.map((stage) => <option key={stage} value={stage}>{t(stage[0].toUpperCase() + stage.slice(1))}</option>)}
            </select>
            <button type="button" className="story-editor-button" onClick={handleAddStep}>{t("Add page")}</button>
          </div>

        </div>

        <footer className="story-editor-card story-preview-toolbar story-preview-footer">
          <p role="status">{t(exceedsBudget ? "This story is too large to save. Replace a large image or remove a page."
            : hasIncompleteGuide ? "Complete all three fields in the parent guide before saving."
            : changed ? "You've edited this story." : "No edits yet.")}</p>
          <button type="button" className="story-editor-button is-primary" onClick={handleSave}
            disabled={!isValid || Boolean(imageJob) || saving}
            data-telemetry={isUpdating ? "parent_story_update" : "parent_story_save"}>
            {t(saving ? "Saving story…" : isUpdating ? "Update story" : "Save story")}
          </button>
        </footer>
      </fieldset>
    </section>
  );
}
