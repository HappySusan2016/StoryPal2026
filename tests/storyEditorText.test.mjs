import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getStoryEditorCaret, getStoryEditorChange, projectStoryEditorText, replaceStoryEditorRange,
} from "../app/lib/storyEditorText.js";
import { hasManualParentGuide, isValidParentGuide } from "../app/lib/parentGuides.js";

const context = { child: { name: "小满", age: 7 } };

/** @module Regression tests for variable display and saving raw text */
test("编辑同名普通文本时保留已有变量，插入变量后光标跟随显示文本", () => {
  const raw = "@child.name 和小满一起玩。";
  const { display, tokens } = projectStoryEditorText(raw, context);
  assert.equal(display, "小满 和小满一起玩。");

  const next = "小满 和小羽一起玩。";
  const change = getStoryEditorChange(display, next, next.indexOf("羽") + 1);
  assert.equal(replaceStoryEditorRange(raw, tokens, change.start, change.end, change.replacement).raw,
    "@child.name 和小羽一起玩。");

  const inserted = replaceStoryEditorRange(raw, tokens, display.length, display.length, "@child.name");
  assert.equal(inserted.raw, "@child.name 和小满一起玩。@child.name");
  const projected = projectStoryEditorText(inserted.raw, context);
  assert.equal(projected.display, "小满 和小满一起玩。小满");
  assert.equal(getStoryEditorCaret(projected.tokens, inserted.caret), projected.display.length);
});

test("兼容旧式占位符，并把跨入变量显示范围的删除映射到整个占位符", () => {
  const raw = "Hi {{ child.name }}! @child.age @unavailable";
  const { display, tokens } = projectStoryEditorText(raw, context);
  assert.equal(display, "Hi 小满! 7 @unavailable");
  const deleted = replaceStoryEditorRange(raw, tokens, 4, 5, "");
  assert.equal(deleted.raw, "Hi ! @child.age @unavailable");
});

test("只修改正文不视为手动编辑家长引导，手动填写的引导支持变量", () => {
  const original = { message: "原文", parentGuide: {
    title: "一起读", description: "原有说明", coActionPrompt: "一起挥手",
  } };
  const editedMessage = { ...original, message: "你好 @child.name" };
  assert.equal(hasManualParentGuide(editedMessage, original), false);

  const parentGuide = { ...original.parentGuide, description: "和 @child.name 一起读" };
  assert.equal(hasManualParentGuide({ ...editedMessage, parentGuide }, original), true);
  assert.equal(isValidParentGuide(parentGuide), true);
  assert.equal(isValidParentGuide({ ...parentGuide, coActionPrompt: "" }), false);
});
