import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { passportGroups } from "../app/lib/passportFields.js";
import { buildStoryPrompt, completeGeneratedBreakChoice, normalizeGeneratedChoices, toStoryModuleSteps, validateGeneratedStory } from "../app/lib/generatedStory.js";
import { storyFocuses, storyScenarios, storyTones } from "../app/lib/storyPromptTemplates.js";
import { getStoryGenerationKey, getStoryGoalDisplayText, getStorySetup, initialStoryPicks, screenStoryText } from "../app/lib/storyWorkshop.js";

test("reuses stories only for the same generation inputs", () => {
  const custom = { scenario: "", focus: "", tone: "", goal: " Give a wave. " };
  const input = { childId: "leo", language: "en", picks: { ...initialStoryPicks, goal: "other" }, custom };
  const key = getStoryGenerationKey("At school", input);
  assert.equal(getStoryGenerationKey("At school", { ...input, custom: { ...custom, scenario: "Unused", goal: "Give a wave." } }), key);
  assert.notEqual(getStoryGenerationKey("At school", { ...input, custom: { ...custom, goal: "Say hello." } }), key);
  assert.notEqual(getStoryGenerationKey("At school", { ...input, picks: { ...input.picks, tone: "4" } }), key);
  assert.notEqual(getStoryGenerationKey("At school", { ...input, childId: "mia" }), key);
  assert.equal(getStoryGenerationKey("At school", { ...input, language: "zh" }), key);
  assert.notEqual(getStoryGenerationKey("A new title", input), key);
});

// Check template mappings for every scenario so no suggested goal or variable substitution is missed.
test("all preset scenarios have five focus goals and a complete prompt", () => {
  assert.equal(storyScenarios.length, 9);
  assert.equal(storyFocuses.length, 5);
  assert.equal(storyTones.length, 6);
  for (const [index, scenario] of storyScenarios.entries()) {
    const picks = { ...initialStoryPicks, scenario: String(index), focus: String(scenario.focus), goal: String(scenario.focus) };
    const setup = getStorySetup({ childName: "Leo" }, picks, {}, "en");
    assert.equal(Object.keys(setup.values).length, 34);
    assert.equal(setup.goals.length, 5);
    assert.equal(setup.values.FOCUS, storyFocuses[scenario.focus].label);
    assert.match(setup.values.PARENT_GOAL, /@child\.name/);
    const prompt = buildStoryPrompt(setup);
    assert.doesNotMatch(prompt, /\$[A-Z_]+|\bLeo\b/);
    assert.ok(prompt.includes(scenario.label));
  }
});

test("uses project defaults, English output and AAC limits", () => {
  const defaults = getStorySetup({ childName: "Leo" }, initialStoryPicks, {}, "en");
  assert.equal(defaults.values.PAGE_COUNT, 5);
  assert.equal(defaults.values.MAX_WORDS_PER_PAGE, 15);
  assert.equal(defaults.values.MAX_CHOICES, 3);
  assert.equal(defaults.values.STAGE_SPLIT, "1 / 2 / 1 / 1");
  assert.equal(defaults.sources.SAFE_WORD, "default");
  assert.equal(defaults.values.SAFE_WORD,
    passportGroups.find(([group]) => group === "sensory")[2].find(([field]) => field === "safeWordsCues")[3]);

  const aac = getStorySetup({
    childName: "Mia", age: "11", communication: { modalities: ["PECS"], comprehensionLevel: "full sentences" },
  }, initialStoryPicks, {}, "zh");
  assert.equal(aac.values.PAGE_COUNT, 8);
  assert.equal(aac.values.MAX_WORDS_PER_PAGE, 12);
  assert.equal(aac.values.MAX_CHOICES, 2);
  assert.equal(aac.values.LANGUAGE, "English");
  assert.equal(aac.breakChoice, "Need a break");
});

test("filters recognizable identifiers and supports custom choices", () => {
  assert.equal(screenStoryText("Leo likes trains.", "Leo"), "@child.name likes trains.");
  assert.equal(screenStoryText("Getting ready at school", "Leo"), "Getting ready at school");
  for (const text of ["12 Oak Street", "Oak Hill School", "leo@example.com", "123-456-7890", "ADHD diagnosis"]) {
    assert.equal(screenStoryText(text, "Leo"), "");
  }
  const setup = getStorySetup({ childName: "Leo", interaction: { interests: "Leo likes trains" } },
    { scenario: "other", focus: "other", tone: "other", goal: "other" },
    { scenario: "Going to the barber", focus: "Asking for a break", tone: "Friendly", goal: "Leo points to a break card." }, "en");
  assert.equal(setup.values.PARENT_GOAL, "@child.name points to a break card.");
  assert.equal(setup.goals[0].value, "focus");
  assert.match(buildStoryPrompt(setup), /Going to the barber/);
});

// Verify that the outgoing prompt excludes free-text profile fields and retains options the parent explicitly entered.
test("excludes private passport text from the model prompt", () => {
  const setup = getStorySetup({
    childName: "Maya Chen",
    accessSafety: { caregiverNotes: "Maya is picked up by Jordan Lee every Friday." },
    interaction: { interests: "Builds models with Jordan Lee." },
    sensory: { triggers: ["fire alarm", "Oak Hill School bell"] },
  }, { ...initialStoryPicks, goal: "other" }, { goal: "Maya points to a card." });
  const prompt = buildStoryPrompt(setup);
  assert.doesNotMatch(prompt, /Maya|Chen|Jordan Lee|Friday|fire alarm|Oak Hill School|Builds models/);
  assert.match(prompt, /@child\.name points to a card/);
});

function sampleBook(setup) {
  return {
    pages: setup.stages.map((stage) => ({
      stage, text: "@child.name takes a breath.", type: stage === "reflection" ? "multiple_choice" : "message",
      imageDescription: "A book rests nearby.",
      ...(stage === "reflection" && {
        choices: ["Breathe", setup.breakChoice],
        choiceImageDescriptions: ["A calm breath.", "A quiet corner."],
      }),
      parentGuide: {
        title: "Practise together",
        description: "Practise a calm breath together.",
        coActionPrompt: stage === "reflection" ? 'Point to "Breathe".' : "Take a breath together.",
      },
    })),
  };
}

test("plans exact page stages and recovers a missing break choice when there is room", () => {
  const setup = getStorySetup({ childName: "Leo" }, initialStoryPicks, {}, "en");
  const prompt = buildStoryPrompt(setup);
  assert.match(prompt, /Page 2: stage "immersion"\.\nPage 3: stage "immersion"\./);
  assert.match(prompt, /Page 4: stage "reflection", type "multiple_choice"\. Include "Need a break"/);
  const book = sampleBook(setup);
  const reflection = book.pages[3];
  delete reflection.choiceImageDescriptions;
  reflection.choices = ["Breathe", "  I NEED A BREAK! "];
  assert.equal(validateGeneratedStory(book, setup), "");
  reflection.choices = ["Breathe", "Sit down"];
  completeGeneratedBreakChoice(book, setup);
  assert.deepEqual(reflection.choices, ["Breathe", "Sit down", setup.breakChoice]);
  assert.equal(validateGeneratedStory(book, setup), "");
  reflection.choices = ["Breathe", "Sit down", "Wave"];
  completeGeneratedBreakChoice(book, setup);
  assert.match(validateGeneratedStory(book, setup), /Page 4.*requested break choice/);
});

test("rejects invalid books and maps valid pages with the generated parent guides", () => {
  const setup = getStorySetup({
    childName: "Mia", communication: { modalities: ["AAC"] }, sensory: { triggers: "balloon pops", sensitivities: "sirens" },
  }, initialStoryPicks, {}, "en");
  const book = sampleBook(setup);
  assert.equal(validateGeneratedStory(book, setup), "");
  const reflection = toStoryModuleSteps(book.pages).find((page) => page.stage === "reflection");
  assert.equal(reflection.type, "choice");
  assert.deepEqual(reflection.options, ["Breathe", setup.breakChoice]);
  assert.deepEqual(reflection.optionImageDescriptions, ["A calm breath.", "A quiet corner."]);
  assert.equal(reflection.parentGuide.coActionPrompt, 'Point to "Breathe".');

  const withChange = (page, change) => {
    const copy = structuredClone(book);
    Object.assign(copy.pages.find(({ stage }) => stage === page), change);
    return validateGeneratedStory(copy, setup);
  };
  assert.match(validateGeneratedStory({ pages: book.pages.slice(1) }, setup), /number of pages/);
  assert.match(withChange("framing", { stage: "immersion" }), /stage order/);
  assert.match(withChange("framing", { text: "a ".repeat(13) }), /shorter/);
  assert.match(withChange("framing", { text: "You must sit." }), /directive/);
  assert.equal(withChange("framing", { imageDescription: "A balloon nearby." }), "");
  assert.match(withChange("framing", { imageDescription: "A balloon pops nearby." }), /Page 1, illustration description:.*sensory trigger/);
  assert.match(withChange("immersion", { text: "A siren sounds." }), /Page 2, story text:.*sensory sensitivity/);
  assert.match(withChange("reflection", { choiceImageDescriptions: [] }), /image description/);
  assert.match(withChange("reflection", { parentGuide: { ...reflection.parentGuide, coActionPrompt: 'Point to "Outside".' } }), /exact choices/);
  assert.match(withChange("reflection", { choices: ["Breathe", "Sit down"] }), /break choice/);
});

// Apply sensory limits from the local profile to child-visible fields outside the story text too.
test("rejects sensory triggers in choices, choice art and input placeholders", () => {
  const setup = getStorySetup({ sensory: { triggers: "fire alarm" } }, initialStoryPicks, {});
  const book = sampleBook(setup);
  const choicePage = book.pages.find(({ stage }) => stage === "reflection");
  choicePage.choices[0] = "Hear the fire alarm";
  const feedback = validateGeneratedStory(book, setup);
  assert.match(feedback, /choice 1:.*sensory trigger/);
  assert.doesNotMatch(feedback, /fire alarm/);

  choicePage.choices[0] = "Breathe";
  choicePage.choiceImageDescriptions[0] = "A fire alarm on the wall.";
  assert.match(validateGeneratedStory(book, setup), /choice 1 illustration description:.*sensory trigger/);

  choicePage.choiceImageDescriptions[0] = "A calm breath.";
  Object.assign(book.pages[0], { type: "child_input", inputPlaceholder: "I hear the fire alarm." });
  assert.match(validateGeneratedStory(book, setup), /input placeholder:.*sensory trigger/);
  book.pages[0].inputPlaceholder = "I can pause.";
  assert.equal(validateGeneratedStory(book, setup), "");
});

// Validate against trigger phrases in the project's default profile without blocking ordinary words within those phrases.
test("matches default sensory phrases without blocking their individual words", () => {
  const setup = getStorySetup({ childName: "Leo" }, initialStoryPicks, {}, "en");
  const book = sampleBook(setup);
  book.pages[0].imageDescription = "A bright smile.";
  assert.equal(validateGeneratedStory(book, setup), "");

  book.pages[0].imageDescription = "A bright, light is on.";
  assert.match(validateGeneratedStory(book, setup), /Page 1, illustration description:.*sensory sensitivity/);

  book.pages[0].text = "There is a sudden noise.";
  book.pages[0].imageDescription = "A bright smile.";
  assert.match(validateGeneratedStory(book, setup), /Page 1, story text:.*sensory trigger/);
});

test("四种界面语言都能翻译预设与自定义场景的建议目标，并保留英文生成内容", () => {
  const custom = { scenario: "A party", focus: "clapping", goal: "Wave goodbye" };
  for (const locale of ["zh", "es", "pt", "bn"]) {
    const dictionary = JSON.parse(readFileSync(new URL(`../app/locales/${locale}.json`, import.meta.url), "utf8"));
    const translate = (key) => dictionary[key] || key;
    for (const { label } of [...storyScenarios, ...storyFocuses, ...storyTones]) {
      assert.ok(dictionary[label], `${locale}: ${label}`);
    }
    for (const scenario of [...storyScenarios.keys()].map(String).concat("other")) {
      const setup = getStorySetup(null, { ...initialStoryPicks, scenario, focus: "other", goal: "focus" }, custom);
      for (const goal of setup.goals) {
        assert.ok(dictionary[goal.template], `${locale}: ${goal.template}`);
        const displayed = getStoryGoalDisplayText(setup, translate, goal.template);
        assert.match(displayed, /@child\.name/);
        assert.doesNotMatch(displayed, /\$[A-Z_]+/);
        assert.notEqual(displayed, goal.text);
      }
      assert.equal(setup.values.PARENT_GOAL, "@child.name practises clapping in this situation.");
      assert.match(getStoryGoalDisplayText(setup, translate), /clapping/);
    }
    const setup = getStorySetup(null, { ...initialStoryPicks, goal: "other" }, custom);
    assert.equal(getStoryGoalDisplayText(setup, translate), custom.goal);
  }
});

test("修正超量和重复选项时保留休息选项、对应插图及同页引用", () => {
  const setup = getStorySetup({ communication: { modalities: ["AAC"] } }, initialStoryPicks, {});
  const book = sampleBook(setup);
  const page = book.pages.find(({ stage }) => stage === "reflection");
  page.choices = [" Breathe ", "breathe", "Wave", setup.breakChoice];
  page.choiceImageDescriptions = ["A calm breath.", "Duplicate.", "A wave.", "A quiet corner."];
  page.parentGuide.coActionPrompt = 'Point to “breathe!”.';
  assert.match(validateGeneratedStory(book, setup), /2 to 2 distinct choices/);
  normalizeGeneratedChoices(book, setup);
  assert.deepEqual(page.choices, ["Breathe", setup.breakChoice]);
  assert.deepEqual(page.choiceImageDescriptions, ["A calm breath.", "A quiet corner."]);
  assert.equal(page.parentGuide.coActionPrompt, 'Point to "Breathe".');
  assert.equal(validateGeneratedStory(book, setup), "");

  page.parentGuide.coActionPrompt = 'Ask your child to choose "Wave".';
  normalizeGeneratedChoices(book, setup);
  assert.match(page.parentGuide.coActionPrompt, /choices on this page/);
  assert.doesNotMatch(page.parentGuide.coActionPrompt, /Wave/);
  assert.equal(validateGeneratedStory(book, setup), "");

  page.choices = ["Breathe", "Breathe"];
  normalizeGeneratedChoices(book, setup);
  assert.match(validateGeneratedStory(book, setup), /distinct choices/);
});
