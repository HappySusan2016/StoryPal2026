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
export async function generateModuleGuides(moduleDefinition, initialSteps, childContext) {
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
    const failed = [];
    for (const index of pending) {
      const step = steps[index];
      try {
        const response = await fetch("/api/generate-coaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepType: step.type,
            stepMessage: step.message || "",
            storyTitle: moduleDefinition.title,
            childContext,
          }),
          signal: AbortSignal.timeout(60000),
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
        console.warn(`Parent guide generation failed for step ${index + 1}`, error);
        failed.push(index);
      }
    }
    if (!failed.length) break;
    // 原生确认框提供键盘操作；取消明确表示重试，而非丢弃编辑内容。
    const savePartial = window.confirm(
      `Parent guides could not be generated for steps ${failed.map((index) => index + 1).join(", ")}.\n\nOK: Save the story with the available guides.\nCancel: Retry only the failed guides.`
    );
    if (savePartial) break;
    pending = failed;
  }
  return steps;
}
