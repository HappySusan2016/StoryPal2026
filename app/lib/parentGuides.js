/* Validation rules for storybook parent guides. */

/** Validate the three required parent guide fields. */
export function isValidParentGuide(guide) {
  return ["title", "description", "coActionPrompt"].every(
    (field) => typeof guide?.[field] === "string" && guide[field].trim()
  );
}

/** Check whether the parent manually edited the guide. The reader generates untouched blank guides on demand. */
export function hasManualParentGuide(step, initialStep) {
  return ["title", "description", "coActionPrompt"].some((field) =>
    (step.parentGuide?.[field] || "") !== (initialStep?.parentGuide?.[field] || ""));
}
