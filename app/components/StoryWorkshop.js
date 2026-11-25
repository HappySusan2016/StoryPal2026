"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "../hooks/useTranslation";
import { storyFocuses, storyScenarios, storyTones } from "../lib/storyPromptTemplates";
import { getStoryGoalDisplayText, getStorySetup, initialStoryPicks, storySteps } from "../lib/storyWorkshop";
import { interpolateStoryText } from "./StoryPlayer";
import styles from "./StoryWorkshop.module.css";

/** @module Four-step wizard options */
const stepNames = ["Scenario", "Today's focus", "Desired tone", "Parent goal"];
const customLabels = ["Describe the situation", "Name the skill to practise", "Describe the tone", "Write your own goal"];
const summaryKeys = ["SCENARIO", "FOCUS", "TONE", "PARENT_GOAL"];
const emptyCustom = { scenario: "", focus: "", tone: "", goal: "" };

export default function StoryWorkshop({ passports, initialChildId, previousGeneration, hasPendingStory, hasUnsavedEdits, onKeepEdits, getTemplateContext, onGenerate, title, backHref, backLabel }) {
  const { t } = useTranslation();

  /** @module Step progress and dependent options */
  const previous = passports.some(({ id }) => id === previousGeneration?.input?.childId) ? previousGeneration : null;
  const [childId, setChildId] = useState(previous?.input.childId || initialChildId || passports[0]?.id || "");
  const passport = passports.find((item) => item.id === childId);
  const [picks, setPicks] = useState(previous?.input.picks || initialStoryPicks);
  const [custom, setCustom] = useState(previous?.input.custom || emptyCustom);
  const [focusTouched, setFocusTouched] = useState(previous?.focusTouched ?? false);
  const [active, setActive] = useState(previous ? storySteps.length : 0);
  const [confirmed, setConfirmed] = useState(previous ? storySteps.length : 0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const setup = getStorySetup(passport, picks, custom);
  const context = getTemplateContext(passport);
  const displayAnswer = (index) => {
    const value = setup.values[summaryKeys[index]];
    if (!value) return t("Not chosen yet");
    const text = index === 3 ? getStoryGoalDisplayText(setup, t) : t(value);
    return interpolateStoryText(text, context);
  };
  const ready = active === storySteps.length && confirmed === storySteps.length
    && summaryKeys.every((key) => setup.values[key]);
  const options = [storyScenarios, storyFocuses, storyTones].map((items) =>
    items.map(({ label }, index) => ({ value: String(index), label })));
  options.push(setup.goals);

  function handlePick(key, value) {
    setError("");
    setPicks((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "scenario" && !focusTouched && storyScenarios[value]) next.focus = String(storyScenarios[value].focus);
      if (["scenario", "focus"].includes(key) && next.goal !== "other") next.goal = next.focus === "other" ? "focus" : next.focus;
      return next;
    });
    if (key === "focus") setFocusTouched(true);
  }

  function handleOpenStep(index) {
    setActive(index);
    setError("");
  }

  function handleNext() {
    const answer = setup.values[summaryKeys[active]];
    if (!answer) {
      setError(t("Choose an option or enter an answer without personal details."));
      return;
    }
    setConfirmed(Math.max(confirmed, active + 1));
    handleOpenStep(active + 1);
  }

  /** @module Full story submission and retries */
  async function handleGenerate(replaceEdits = false) {
    if (busyRef.current || !ready || !passport) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await onGenerate({ childId, picks, custom }, focusTouched, replaceEdits);
    } catch (failure) {
      setError(failure.message || "Could not generate the story. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /** @module Wizard form and preview of variables sent to the AI */
  return (
    <>
      <header className={styles.heading}>
        {busy ? <span className="story-editor-back" aria-disabled="true">{backLabel}</span>
          : <Link className="story-editor-back" href={backHref}>{backLabel}</Link>}
        <p className={styles.eyebrow}>
          {t("Story workshop")} · {ready ? t("All {total} steps done", { total: storySteps.length })
            : t("Step {step} of {total}", { step: active + 1, total: storySteps.length })}
        </p>
        <h1>{t("Make a new story")}</h1>
        <p><strong>{t("Story title")}</strong> · {title}</p>
        <p>{t('Choose the situation, the skill to practise, the tone and your goal, one step at a time. Pick "Other" on any step to type your own.')}</p>
      </header>
      <div className={styles.workshop}>
        <div className={styles.steps}>
          <div className={styles.progress} aria-hidden="true">
            {storySteps.map((key, index) => (
              <span key={key} data-state={index === active ? "active" : index < confirmed ? "complete" : "locked"} />
            ))}
          </div>
          {storySteps.map((key, index) => {
            const isActive = active === index;
            const isComplete = index < confirmed && !isActive;
            const isLocked = !isActive && !isComplete;
            return (
              <section key={key} className={styles.card} data-state={isActive ? "active" : isComplete ? "complete" : "locked"} aria-current={isActive ? "step" : undefined}>
                <div className={styles.stepHeader}>
                  <span className={styles.number} data-complete={isComplete} aria-hidden="true">
                    {isComplete ? <Check size={17} /> : index + 1}
                  </span>
                  <div>
                    <h2>{t(stepNames[index])}</h2>
                    {isComplete && <p>{displayAnswer(index)}</p>}
                    {isLocked && <p>{t("Finish the step above first")}</p>}
                  </div>
                  {isComplete && (
                    <button type="button" className={styles.change} disabled={busy} onClick={() => handleOpenStep(index)}>{t("Change")}</button>
                  )}
                </div>
                {isActive && (
                  <div className={styles.stepBody}>
                    {key === "goal" && <p className={styles.hint}>{t("Suggested goals for this scenario. The one matching today's focus is picked for you.")}</p>}
                    <fieldset className={styles.options} data-wide={key === "goal"} aria-label={t(stepNames[index])}>
                      {options[index].concat({ value: "other", label: "Other" }).map(({ value, label, template }) => {
                        const [group, scenario] = key === "scenario" && value !== "other" ? t(label).split(/[:：]\s*/, 2) : [];
                        const kicker = scenario ? group : template || value === "other" ? t(label) : "";
                        return (
                          <label key={value} className={styles.option} data-custom={value === "other"}>
                            <input type="radio" name={key} value={value} checked={picks[key] === value} onChange={() => handlePick(key, value)} />
                            {kicker && <b>{kicker}</b>}
                            <span>{template ? interpolateStoryText(getStoryGoalDisplayText(setup, t, template), context)
                              : value === "other" ? t(customLabels[index]) : scenario || t(label)}</span>
                            {key === "focus" && String(setup.scenario?.focus) === value && <small>{t("Suggested for this scenario")}</small>}
                          </label>
                        );
                      })}
                    </fieldset>
                    {picks[key] === "other" && (
                      <label className={styles.custom}>
                        {t(customLabels[index])}
                        <textarea rows={2} value={custom[key]} maxLength={500} onChange={(event) => {
                          setError("");
                          setCustom({ ...custom, [key]: event.target.value });
                        }} />
                      </label>
                    )}
                    <div className={styles.actions}>
                      {index > 0 ? <button type="button" className={styles.button} onClick={() => handleOpenStep(index - 1)}>{t("Back")}</button> : <span />}
                      {error && <p className={styles.error} role="alert">{t(error)}</p>}
                      <button type="button" className={styles.next} onClick={handleNext}>
                        {index < 3 ? t("Next: {step}", { step: t(stepNames[index + 1]) }) : t("Done")}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2 id="workshop-child-label">{t("Who is this story for?")}</h2>
            <select className={styles.field} aria-labelledby="workshop-child-label" value={childId} disabled={busy} onChange={(event) => {
              setChildId(event.target.value);
              setError("");
            }}>
              {passports.map((item) => <option key={item.id} value={item.id}>{item.childName}</option>)}
            </select>
          </section>
          <section className={styles.panel} aria-labelledby="workshop-choices-label">
            <h2 id="workshop-choices-label">{t("Your choices")}</h2>
            <dl className={styles.summary}>
              {stepNames.map((name, index) => (
                <div key={name}>
                  <dt>{t(name)}</dt>
                  <dd data-pending={index > active && index >= confirmed}>{index === active || index < confirmed
                    ? displayAnswer(index)
                    : t("Not chosen yet")}</dd>
                </div>
              ))}
            </dl>
            {hasPendingStory ? (
              <div className={styles.confirm}>
                <p>{t(hasUnsavedEdits
                  ? "You've edited the current story. Generating again replaces your edits."
                  : "You haven't saved the generated story in the editor yet. Keep it or generate again.")}</p>
                <div className={styles.confirmActions}>
                  <button type="button" className={styles.next} onClick={() => handleGenerate(true)} disabled={!ready || !passport || busy}>
                    {t(busy ? "Generating story…" : "Replace and generate")}
                  </button>
                  <button type="button" className={styles.button} onClick={onKeepEdits} disabled={busy}>{t("Keep my edits")}</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.generate} onClick={() => handleGenerate()} disabled={!ready || !passport || busy}>
                {t(busy ? "Generating story…" : "Generate story")}
              </button>
            )}
            {busy && <p className={styles.hint} role="status">{t("Writing the pages and parent guides…")}</p>}
            {ready && error && <p className={styles.error} role="alert">{t(error)}</p>}
            {!ready && <details className={styles.preview}>
              <summary>{t("Variables sent to the AI")}</summary>
              <div className={styles.variables}>
                <table aria-label={t("Variables sent to the AI")}>
                  <tbody>
                    {Object.entries(setup.values).map(([key, value]) => (
                      <tr key={key}>
                        <th scope="row">{`$${key}`}</th>
                        <td>{value || "—"}</td>
                        <td><small data-source={setup.sources[key]}>{t(setup.sources[key])}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>}
          </section>
        </aside>
      </div>
    </>
  );
}
