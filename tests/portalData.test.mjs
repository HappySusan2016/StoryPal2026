/* Portal compatibility tests for legacy data preservation, unlinking, and dictionary completeness. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/lib/portalData.js", import.meta.url),
  "utf8",
);
const {
  isBuiltInStory,
  toMillis,
  updatePassportDetails,
  detachProfileFromStories,
  getProfileStories,
  getNewestProfiles,
} = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("时间兼容 Firestore、缓存对象和 ISO 日期", () => {
  const time = Date.parse("2026-11-16T00:00:00Z");
  assert.equal(toMillis({ toMillis: () => time }), time);
  assert.equal(toMillis({ seconds: time / 1000, nanoseconds: 0 }), time);
  assert.equal(toMillis("2026-11-16T00:00:00Z"), time);
  assert.equal(toMillis(undefined), 0);
  assert.equal(toMillis("invalid"), 0);
});

test("儿童档案按创建时间倒序，编辑旧档案不会改变顺序", () => {
  const passports = [
    { id: "legacy", updatedAt: "2026-11-24" },
    { id: "first", createdAt: "2026-11-20", updatedAt: "2026-11-24" },
    { id: "legacy-2" },
    { id: "latest", createdAt: { seconds: Date.parse("2026-11-23") / 1000 } },
  ];

  assert.deepEqual(getNewestProfiles(passports).map(({ id }) => id), ["latest", "first", "legacy", "legacy-2"]);
  assert.equal(passports[0].id, "legacy");
});

test("基础字段编辑保留旧护照隐藏数据，允许清空可选字段", () => {
  const old = {
    id: "child-1",
    childName: "Sunny",
    age: "6",
    color: "blue",
    pronouns: { subject: "they" },
    sensory: { triggers: "noise" },
    communication: { modalities: ["AAC"] },
    interaction: { interests: "trains", culturalContext: "keep" },
    accessSafety: { caregiverNotes: "keep" },
  };
  const updated = updatePassportDetails(old, {
    childName: "Sun",
    age: "6",
    color: "",
    interests: "",
  });
  assert.equal(updated.id, old.id);
  assert.deepEqual(updated.sensory, old.sensory);
  assert.deepEqual(updated.communication, old.communication);
  assert.deepEqual(updated.accessSafety, old.accessSafety);
  assert.deepEqual(updated.pronouns, old.pronouns);
  assert.equal(updated.interaction.culturalContext, "keep");
  assert.equal(updated.interaction.interests, "");
  assert.equal(updated.color, "");
  assert.equal(old.color, "blue");
});

test("解除关联保留所有绘本及内容，包括云端示例", () => {
  const stories = [
    { id: "a", childId: "child-1", steps: [{ message: "keep" }] },
    { id: "b", childId: "child-2" },
    { id: "demo-green-mission", childId: "child-1" },
  ];
  const result = detachProfileFromStories(stories, "child-1");
  assert.equal(result.length, stories.length);
  assert.equal(result[0].childId, null);
  assert.deepEqual(result[0].steps, stories[0].steps);
  assert.equal(result[1].childId, "child-2");
  assert.equal(result[2].childId, null);
  assert.equal(stories[0].childId, "child-1");
  assert.equal(isBuiltInStory(result[2]), true);
  assert.equal(isBuiltInStory({ id: "demo-user-created" }), false);
});

test("五种语言保留参考词典的每一个词条", async () => {
  for (const code of ["en", "es", "pt", "bn", "zh"]) {
    const dictionary = JSON.parse(
      await readFile(
        new URL(`../app/locales/${code}.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.ok(dictionary["Stories without a profile"]);
    assert.ok(dictionary["Adult consent introduction"]);
    assert.ok(dictionary["Could not save changes. Please try again."]);
    if (code !== "en") {
      const english = JSON.parse(
        await readFile(
          new URL("../app/locales/en.json", import.meta.url),
          "utf8",
        ),
      );
      for (const key of Object.keys(english))
        assert.ok(dictionary[key], `${code}: ${key}`);
    }
  }
});

/** @module Regression tests for per-child default storybooks and legacy profile fields */
const defaultSource = await readFile(new URL("../app/lib/defaultModules.js", import.meta.url), "utf8");
const { DEFAULT_MODULES, createDefaultModules, getDefaultStoryTemplate, getMissingDefaultModules } = await import(`data:text/javascript;base64,${Buffer.from(defaultSource).toString("base64")}`);
const fieldSource = await readFile(new URL("../app/lib/passportFields.js", import.meta.url), "utf8");
const { hasDuplicateChildName, passportGroups, updatePassportFromForm } = await import(`data:text/javascript;base64,${Buffer.from(fieldSource).toString("base64")}`);

test("新建和改名共用重名规则，旧档案保留原名可继续保存", () => {
  const first = { id: "a", childName: "Alex" };
  const second = { id: "b", childName: "Sunny" };
  assert.equal(hasDuplicateChildName({ id: "new", childName: " alex " }, [first]), true);
  assert.equal(hasDuplicateChildName({ ...second, childName: "ALEX" }, [first, second], second), true);
  assert.equal(hasDuplicateChildName(second, [first, second], second), false);
});

test("新儿童各自获得三本原始绘本，重试 ID 稳定且内容互不影响", () => {
  const first = createDefaultModules("child-a", "2026-11-17T00:00:00Z");
  const second = createDefaultModules("child-b");
  assert.equal(first.length, 3);
  assert.deepEqual(first.map(story => story.steps), DEFAULT_MODULES.map(story => story.steps));
  assert.ok(first.every(story => story.childId === "child-a"));
  assert.ok(second.every(story => !first.some(other => other.id === story.id)));
  assert.deepEqual(first.map(story => story.id), createDefaultModules("child-a").map(story => story.id));
  first[0].steps[0].message = "Edited";
  assert.notEqual(second[0].steps[0].message, "Edited");
  assert.notEqual(DEFAULT_MODULES[0].steps[0].message, "Edited");
});

test("不同孩子的默认绘本和旧版 ID 映射到同一模板，同名自建绘本独立", () => {
  const [template] = DEFAULT_MODULES;
  const [first] = createDefaultModules("child-a");
  const [second] = createDefaultModules("child-b");
  assert.equal(getDefaultStoryTemplate(first), template);
  assert.equal(getDefaultStoryTemplate(second), template);
  assert.equal(getDefaultStoryTemplate({ ...template, childId: "child-a" }), template);
  assert.equal(getDefaultStoryTemplate({ ...first, id: "custom-story" }), undefined);
});

test("详情提交时空白字段使用默认文案，手填内容和历史数据保留", () => {
  const data = new FormData();
  data.set("childName", " Alex ");
  data.set("age", " 6 ");
  passportGroups.forEach(([group, , fields]) => fields.forEach(([field]) => data.set(`${group}.${field}`, "")));
  data.set("communication.latency", " 10 seconds ");
  data.set("sensory.safeWordsCues", "   ");
  data.append("modalities", "AAC");
  const existing = { id: "a", avatar: "bird", color: "blue", pronouns: { custom: "kept", subject: "she" }, communication: { modalities: ["Custom", "Verbal"] } };
  const updated = updatePassportFromForm(existing, data, "unused");
  assert.equal(updated.id, "a");
  assert.equal(updated.avatar, "bird");
  assert.equal(updated.color, "blue");
  assert.equal(updated.childName, "Alex");
  for (const [group, , fields] of passportGroups) {
    for (const [field, , , example] of fields) {
      if (group === "communication" && field === "latency") continue;
      assert.equal(updated[group][field], example);
    }
  }
  assert.equal(updated.pronouns.custom, "kept");
  assert.equal(updated.communication.latency, "10 seconds");
  assert.deepEqual(updated.communication.modalities, ["Custom", "AAC"]);
  assert.equal(existing.pronouns.subject, "she");
  const created = updatePassportFromForm(null, data, "new");
  assert.equal(created.id, "new");
  assert.ok(!Object.hasOwn(created, "avatar"));
  assert.equal(passportGroups.reduce((sum, [, , fields]) => sum + fields.length, 0), 21);
});

test("基础档案只提交名字与年龄，详细字段延后填写且不误清空历史数据", () => {
  const data = new FormData();
  data.set("childName", " Sunny ");
  data.set("age", " 6 ");
  const created = updatePassportFromForm(null, data, "new-child");
  assert.equal(created.childName, "Sunny");
  assert.equal(created.age, "6");
  assert.deepEqual(created.communication.modalities, []);
  assert.equal(created.sensory.safeWordsCues, "");
  assert.ok(!Object.hasOwn(created, "avatar"));

  const existing = {
    ...created,
    avatar: "bird",
    communication: { modalities: ["AAC", "Custom"], latency: "10 seconds" },
    sensory: { safeWordsCues: "Take a breath" },
  };
  const updated = updatePassportFromForm(existing, data, "unused");
  assert.equal(updated.id, "new-child");
  assert.equal(updated.avatar, "bird");
  assert.deepEqual(updated.communication.modalities, ["AAC", "Custom"]);
  assert.equal(updated.communication.latency, "10 seconds");
  assert.equal(updated.sensory.safeWordsCues, "Take a breath");
});

/** @module Regression tests for storybook visibility and default backfill */
test("公共与失效关联绘本不展示，原始数据保留且孩子之间隔离", () => {
  const stories = [
    { id: "demo-green-mission", childId: null },
    { id: "unassigned" },
    { id: "deleted-profile", childId: "removed" },
    { id: "a-story", childId: "a", steps: [{ message: "Kept" }] },
    { id: "b-story", childId: "b" },
  ];
  const passports = [{ id: "a" }, { id: "b" }];
  const visible = getProfileStories(stories, passports);
  assert.deepEqual(visible.map(story => story.id), ["a-story", "b-story"]);
  assert.equal(stories.length, 5);
  assert.equal(visible[0], stories[3]);
  assert.deepEqual(getProfileStories(stories, []), []);
  assert.deepEqual(getProfileStories(detachProfileFromStories(stories, "a"), passports).map(story => story.id), ["b-story"]);
});

test("按创建时间倒序展示绘本，兼容缓存时间戳且保留源数据顺序", () => {
  const stories = [
    { id: "old", childId: "a", createdAt: { seconds: 1 }, updatedAt: "2026-11-19" },
    { id: "missing", childId: "a" },
    { id: "new", childId: "a", createdAt: { seconds: 1, nanoseconds: 500_000_000 } },
    { id: "same-time", childId: "a", createdAt: "1970-01-01T00:00:01.500Z" },
  ];
  assert.deepEqual(getProfileStories(stories, [{ id: "a" }]).map(story => story.id), [
    "new", "same-time", "old", "missing",
  ]);
  assert.deepEqual(stories.map(story => story.id), ["old", "missing", "new", "same-time"]);
});

test("按孩子计算缺少的默认绘本，公共示例不作为有效关联", () => {
  const passports = [{ id: "a" }, { id: "b" }];
  const missing = getMissingDefaultModules(DEFAULT_MODULES, passports, "2026-11-17T00:00:00Z");
  assert.equal(missing.length, 6);
  assert.equal(missing.filter(story => story.childId === "a").length, 3);
  assert.equal(missing.filter(story => story.childId === "b").length, 3);
  assert.deepEqual(getMissingDefaultModules([...DEFAULT_MODULES, ...missing], passports), []);
  assert.deepEqual(getMissingDefaultModules(DEFAULT_MODULES, []), []);
  assert.deepEqual(getProfileStories([...DEFAULT_MODULES, ...missing], passports), missing);
});

test("计算缺失绘本时保留已编辑和旧 ID 关联的默认绘本", () => {
  const passports = [{ id: "a" }];
  const defaults = createDefaultModules("a");
  defaults[0].steps[0].message = "My edited message";
  const legacy = { ...DEFAULT_MODULES[1], childId: "a" };
  const missing = getMissingDefaultModules([defaults[0], legacy], passports);
  assert.deepEqual(missing.map(story => story.id), ["a-demo-school-wave"]);
  assert.equal(defaults[0].steps[0].message, "My edited message");
  assert.deepEqual(getMissingDefaultModules(defaults.slice(1), passports).map(story => story.id), ["a-demo-green-mission"]);
});
