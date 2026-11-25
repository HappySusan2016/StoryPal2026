/** @module Story variables and their positions in the input */
export const storyTextVariablePattern = /@(\w+(?:\.\w+)*)|\{\{\s*([^}]+)\s*\}\}/g;

export function resolveStoryVariable(path, context) {
  return path.trim().split(".").reduce((value, key) => value?.[key], context);
}

/** Track variable ranges in both raw and displayed text so identical plain text stays plain text on save. */
export function projectStoryEditorText(raw, context) {
  const tokens = [];
  let offset = 0;
  const display = raw.replace(storyTextVariablePattern, (match, atPath, legacyPath, rawStart) => {
    const value = resolveStoryVariable(atPath ?? legacyPath, context);
    if ((typeof value !== "string" && typeof value !== "number") || value === "") return match;
    const label = String(value);
    tokens.push({ rawStart, rawEnd: rawStart + match.length, start: rawStart + offset, end: rawStart + offset + label.length });
    offset += label.length - match.length;
    return label;
  });
  return { display, tokens };
}

/** Apply input edits to the corresponding raw range and treat each displayed variable as a single unit. */
export function replaceStoryEditorRange(raw, tokens, start, end, replacement) {
  function rawPosition(position, edge) {
    let offset = 0;
    for (const token of tokens) {
      if (position <= token.start) break;
      if (position < token.end) return token[edge];
      offset = token.rawEnd - token.end;
    }
    return position + offset;
  }

  const rawStart = rawPosition(start, "rawStart");
  const rawEnd = rawPosition(end, "rawEnd");
  return { raw: raw.slice(0, rawStart) + replacement + raw.slice(rawEnd), caret: rawStart + replacement.length };
}

/** Use the caret to bound the common prefix and suffix and preserve placeholders next to repeated text. */
export function getStoryEditorChange(previous, next, caret) {
  let start = 0;
  while (start < Math.min(previous.length, caret) && previous[start] === next[start]) start++;
  let suffix = 0;
  while (suffix < Math.min(previous.length - start, next.length - caret)
    && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  return { start, end: previous.length - suffix, replacement: next.slice(start, next.length - suffix) };
}

export function getStoryEditorCaret(tokens, rawCaret) {
  let offset = 0;
  for (const token of tokens) {
    if (rawCaret <= token.rawStart) break;
    if (rawCaret < token.rawEnd) return token.end;
    offset = token.end - token.rawEnd;
  }
  return rawCaret + offset;
}
