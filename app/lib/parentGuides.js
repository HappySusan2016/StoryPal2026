/* Generate parent guides when saving a storybook and retry only failed steps. */

/** Validate the three required guide text fields. */
export function isValidParentGuide(guide) {
  return ["title", "description", "coActionPrompt"].every(
    (field) => typeof guide?.[field] === "string" && guide[field].trim()
  );
}

/** Compare the step content that affects guides, ignoring images, order, and the guides themselves. */
export function hasGuideContentChanged(step, initialStep) {
  const content = (item) => JSON.stringify([
    item.type,
    item.message || "",
    item.options || [],
    item.placeholder || "",
  ]);
  return !initialStep || content(step) !== content(initialStep);
}

/** Reuse the existing Gemini endpoint and let users confirm a partial save or retry only failed steps. */
export async function generateModuleGuides(moduleDefinition, initialSteps, childContext, { onProgress, onFailure } = {}) {
  const initialById = new Map(initialSteps.map((step) => [step.id, step]));
  const steps = moduleDefinition.steps.map((step) => {
    const initialStep = initialById.get(step.id);
    const { parentGuide, ...content } = step;
    return !hasGuideContentChanged(step, initialStep) && isValidParentGuide(initialStep?.parentGuide)
      ? { ...content, parentGuide: initialStep.parentGuide }
      : content;
  });
  let pending = steps.map((step, index) => index).filter((index) => !steps[index].parentGuide);

  while (pending.length) {
    // Each retry round shares a one-minute budget so more steps do not extend the save wait.
    const batchSignal = AbortSignal.timeout(60000);
    const failed = [];
    let completed = steps.length - pending.length;
    onProgress?.({ completed, total: steps.length });
    for (const index of pending) {
      const step = steps[index];
      try {
        batchSignal.throwIfAborted();
        const response = await fetch("/api/generate-coaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepType: step.type,
            stepMessage: step.message || "",
            storyTitle: moduleDefinition.title,
            childContext,
          }),
          signal: batchSignal,
        });
        if (!response.ok) throw new Error(`Guide generation failed: ${response.status}`);
        const { guide } = await response.json();
        if (!isValidParentGuide(guide)) throw new Error("Invalid parent guide");
        // Save only fields defined in the schema and discard extra model output.
        step.parentGuide = {
          title: guide.title,
          description: guide.description,
          coActionPrompt: guide.coActionPrompt,
        };
      } catch (error) {
        console.warn(`Parent guide generation failed for step ${index + 1}`, { name: error?.name });
        failed.push(index);
      }
      completed += 1;
      onProgress?.({ completed, total: steps.length });
    }
    if (!failed.length) break;
    // Let the page present the recovery options. Keep successful results and retry only steps with missing guides.
    const savePartial = await onFailure({
      failedSteps: failed.map((index) => index + 1),
      timedOut: batchSignal.aborted,
    });
    if (savePartial) break;
    pending = failed;
  }
  return steps;
}
