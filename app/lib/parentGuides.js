/* 保存绘本时生成父母引导，仅重试失败步骤。 */

/** 校验引导的三个必需文本字段。 */
export function isValidParentGuide(guide) {
  return ["title", "description", "coActionPrompt"].every(
    (field) => typeof guide?.[field] === "string" && guide[field].trim()
  );
}

/** 比较影响引导的步骤内容，忽略图片、顺序和引导本身。 */
export function hasGuideContentChanged(step, initialStep) {
  const content = (item) => JSON.stringify([
    item.type,
    item.message || "",
    item.options || [],
    item.placeholder || "",
  ]);
  return !initialStep || content(step) !== content(initialStep);
}

/** 复用现有 Gemini 接口，确认保存部分结果或仅重试失败项。 */
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
    // 每轮重试共享一分钟预算，避免步骤数放大保存等待时间。
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
        // 仅保存约定字段，避免模型输出额外数据。
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
    // 由页面展示明确操作；保留成功结果，只重试未生成的步骤。
    const savePartial = await onFailure({
      failedSteps: failed.map((index) => index + 1),
      timedOut: batchSignal.aborted,
    });
    if (savePartial) break;
    pending = failed;
  }
  return steps;
}
