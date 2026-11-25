/* The preview and generation request share the same AI story variables, defaults, and page count rules. */
import { passportGroups } from "./passportFields.js";
import { storyFocuses, storyScenarios, storyTones } from "./storyPromptTemplates.js";

export const storySteps = ["scenario", "focus", "tone", "goal"];
export const storyStages = ["framing", "immersion", "reflection", "continuity"];

const passportVariables = [
  ["RESPONSE_LATENCY", "communication", "latency"],
  ["YES_NO_CONVENTION", "communication", "yesNoConventions"],
  ["NOT_UNDERSTANDING_SIGNALS", "communication", "dontUnderstandSignals"],
  ["SENSORY_SENSITIVITIES", "sensory", "sensitivities"],
  ["SENSORY_TRIGGERS", "sensory", "triggers"],
  ["CALMING_STRATEGIES", "sensory", "strategies"],
  ["SAFE_WORD", "sensory", "safeWordsCues"],
  ["REINFORCEMENT", "interaction", "reinforcementPreferences"],
  ["INTERESTS", "interaction", "interests"],
  ["DOS_AND_DONTS", "interaction", "dosDonts"],
  ["IDENTITY_LANGUAGE", "interaction", "identityLanguage"],
  ["CULTURAL_CONTEXT", "interaction", "culturalContext"],
  ["ACCESSIBILITY_NEEDS", "accessSafety", "accessibilityNeeds"],
  ["DEESCALATION_STRATEGIES", "accessSafety", "deescalationStrategies"],
  ["CAREGIVER_NOTES", "accessSafety", "caregiverNotes"],
];

const ageLimits = [
  [[4, 8, 2], [4, 12, 2], [5, 15, 2]],
  [[4, 10, 2], [5, 15, 3], [6, 20, 3]],
  [[5, 12, 2], [6, 20, 3], [7, 30, 3]],
  [[5, 15, 2], [7, 25, 3], [8, 40, 4]],
  [[6, 15, 2], [7, 30, 3], [8, 50, 4]],
];
const stageSplits = [[1, 1, 1, 1], [1, 2, 1, 1], [1, 2, 2, 1], [1, 3, 2, 1], [1, 3, 2, 2]];
const modalities = ["AAC", "PECS", "Gestures", "Sign", "Verbal"];
const pronouns = {
  PRONOUN_SUBJECT: "subject",
  PRONOUN_OBJECT: "object",
  PRONOUN_POSSESSIVE_ADJ: "possessiveAdjective",
  PRONOUN_POSSESSIVE: "possessivePronoun",
};
export const defaultStoryPronouns = Object.fromEntries(
  passportGroups.find(([group]) => group === "pronouns")[2].map(([field, , , fallback]) => [field, fallback]),
);
const customGoals = [
  "$CHILD_NAME practises greeting someone during this situation.",
  "$CHILD_NAME waits for a turn during this situation.",
  "$CHILD_NAME follows the steps of this situation in order.",
  "$CHILD_NAME moves into and out of this situation using $CALMING_STRATEGIES.",
  "$CHILD_NAME uses $SAFE_WORD or $CALMING_STRATEGIES if this situation feels like too much.",
];

export const initialStoryPicks = { scenario: "0", focus: "0", tone: "5", goal: "0" };

/** Compare only generation inputs, ignoring unselected Other text and the order of user actions. */
export function getStoryGenerationKey(title, { childId, picks, custom }) {
  // Keep the language in a fixed position for compatibility with legacy English story generation records.
  return JSON.stringify([title, childId, "en", storySteps.map((step) =>
    [picks[step], picks[step] === "other" ? custom[step].trim() : ""])]);
}

/** Replace template variables in a single pass so symbols in parent-entered text cannot become new variables. */
export function fillStoryTemplate(template, values) {
  return template.replace(/\$([A-Z_]+)/g, (match, key) => values[key] ?? match);
}

/** Limit free-text length and filter recognizable forms of personal information. */
export function screenStoryText(value, name = "", maxLength = 500) {
  const text = Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : "";
  const trimmed = text.trim().slice(0, maxLength);
  if (/@[\w.]+|https?:\/\/|www\.|(?:\+?\d[\s().-]*){7,}|\b\d{1,6}\s+(?:[\p{L}\d.-]+\s+){0,5}(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd)\b|\b(?:diagnos\w*|ADHD|ASD|autism spectrum disorder)\b|(?:[\p{Script=Han}]{2,}(?:小学|中学|幼儿园))|(?:门牌|确诊)|\d+\s*号/iu.test(trimmed)
    || /\b(?!At\b|The\b|To\b|A\b|Leaving\b|Entering\b)(?:\p{Lu}[\p{L}'.-]+\s+)+(?:School|Academy|Elementary|Kindergarten)\b/u.test(trimmed)) {
    return "";
  }
  const fullName = name.trim();
  if (!fullName) return trimmed;
  // Replace both the full name and its space-separated parts, matching the full name first.
  const names = [fullName, ...fullName.split(/\s+/).filter((part) => part.length > 1 && part !== fullName)];
  const pattern = names.map((part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return /^[\p{Script=Han}]+$/u.test(part) ? escaped : `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
  }).join("|");
  return trimmed.replace(new RegExp(pattern, "giu"), "@child.name");
}

/** Use the project's profile defaults and preserve the 5–6 age fallback when a profile has no age. */
export function getStorySetup(passport, picks, custom) {
  const values = {};
  const sources = {};
  const put = (key, value, source) => {
    values[key] = value;
    sources[key] = source;
  };
  const name = typeof passport?.childName === "string" ? passport.childName : "";
  put("CHILD_NAME", "@child.name", "passport");
  const age = Number(passport?.age);
  const hasAge = Number.isSafeInteger(age) && age > 0 && age <= 120;
  put("CHILD_AGE", hasAge ? age : 6, hasAge ? "passport" : "default");
  for (const [key, field] of Object.entries(pronouns)) {
    put(key, `@child.pronouns.${field}`, passport?.pronouns?.[field]?.trim() ? "passport" : "default");
  }
  const modes = Array.isArray(passport?.communication?.modalities)
    ? modalities.filter((mode) => passport.communication.modalities.includes(mode)) : [];
  put("COMMUNICATION_MODES", modes.join(", ") || "Verbal", modes.length ? "passport" : "default");

  const comprehension = passport?.communication?.comprehensionLevel?.trim() || "";
  const level = /\b(?:fluent|full sentences?|age.appropriate|reads independently|conversational)\b/i.test(comprehension) || /流利|独立阅读|完整句/.test(comprehension) ? 2
    : /\b(?:emerging|single words?|pictures?|limited|early|non.verbal|[12](?:[–-][12])?[- ]step directions?)\b/i.test(comprehension) || /单词|图片|初阶/.test(comprehension) ? 0 : 1;
  put("COMPREHENSION_LEVEL", ["Emerging", "Developing", "Fluent"][level], comprehension ? "passport" : "default");

  // Keep free-text profile fields out of the model prompt and retain sensory limits locally for output validation.
  const sensoryLimits = {};
  for (const [key, group, field] of passportVariables) {
    const standard = passportGroups.find(([id]) => id === group)[2].find(([id]) => id === field)[3];
    put(key, key === "CAREGIVER_NOTES" ? "not provided" : standard, "default");
    if (key === "SENSORY_SENSITIVITIES" || key === "SENSORY_TRIGGERS") {
      const value = passport?.[group]?.[field];
      const text = Array.isArray(value) ? value.filter((item) => typeof item === "string").join(", ") : value;
      sensoryLimits[key] = typeof text === "string" && text.trim() ? text : standard;
    }
  }

  put("LANGUAGE", "English", "default");
  const scenario = storyScenarios[picks.scenario];
  const focus = storyFocuses[picks.focus];
  const tone = storyTones[picks.tone];
  for (const [key, option] of [["scenario", scenario], ["focus", focus], ["tone", tone]]) {
    const value = option?.label || (picks[key] === "other" ? screenStoryText(custom[key], name) : "");
    put(key.toUpperCase(), value, "parent");
  }
  put("FOCUS_GUIDANCE", fillStoryTemplate(focus?.guidance || "Practise the parent's chosen focus in this situation.", values), "calculated");
  put("TONE_GUIDANCE", tone?.guidance || "Use the requested tone while following the writing rules.", "calculated");

  const customFocusGoal = "$CHILD_NAME practises $FOCUS in this situation.";
  const goals = (scenario?.goals || customGoals).map((goal, index) => ({
    value: String(index),
    label: storyFocuses[index].label,
    template: goal,
    text: fillStoryTemplate(goal, values),
  }));
  if (picks.focus === "other" && values.FOCUS) {
    goals.unshift({ value: "focus", label: "Your focus", template: customFocusGoal, text: fillStoryTemplate(customFocusGoal, values) });
  }
  const selectedGoal = goals.find(({ value }) => value === picks.goal);
  put("PARENT_GOAL", picks.goal === "other"
    ? screenStoryText(custom.goal, name)
    : selectedGoal?.text || "", "parent");

  const band = !hasAge ? 1 : age <= 4 ? 0 : age <= 6 ? 1 : age <= 9 ? 2 : age <= 12 ? 3 : 4;
  const [pages, maxWords, maxChoices] = ageLimits[band][level];
  const usesAac = modes.includes("AAC") || modes.includes("PECS");
  const split = stageSplits[pages - 4];
  put("PAGE_COUNT", pages, "calculated");
  put("MAX_WORDS_PER_PAGE", usesAac ? Math.min(maxWords, 12) : maxWords, "calculated");
  put("MAX_CHOICES", usesAac ? 2 : maxChoices, "calculated");
  put("STAGE_SPLIT", split.join(" / "), "calculated");

  return {
    values, sources, sensoryLimits, goals, goalTemplate: selectedGoal?.template, locale: "en", breakChoice: "Need a break", usesAac, scenario,
    stages: storyStages.flatMap((stage, index) => Array(split[index]).fill(stage)),
  };
}

/** Translate the fixed goal template before inserting profile variables. Preserve custom goals as entered. */
export function getStoryGoalDisplayText(setup, translate, template = setup.goalTemplate) {
  if (!template) return setup.values.PARENT_GOAL;
  const displayValues = Object.fromEntries(Object.entries(setup.values).map(([key, value]) => [
    key, setup.sources[key] === "default" && typeof value === "string" ? translate(value) : value,
  ]));
  return fillStoryTemplate(translate(template), displayValues);
}
