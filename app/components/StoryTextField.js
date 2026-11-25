"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  getStoryEditorCaret, getStoryEditorChange, projectStoryEditorText,
  replaceStoryEditorRange, resolveStoryVariable,
} from "../lib/storyEditorText";
import { useTranslation } from "../hooks/useTranslation";

/** @module Story variable menu */
const variables = [
  { label: "Child's Name", path: "child.name" },
  { label: "Child's Age", path: "child.age" },
  { label: "Pronoun (they/he/she)", path: "child.pronouns.subject" },
  { label: "Pronoun (them/him/her)", path: "child.pronouns.object" },
  { label: "Possessive (their/his/her)", path: "child.pronouns.possessiveAdjective" },
  { label: "Possessive (theirs/his/hers)", path: "child.pronouns.possessivePronoun" },
];

/** @module Sync the resolved input text with the raw draft */
export default function StoryTextField({ label, value = "", onValueChange, context, rows, placeholder, className }) {
  const { t } = useTranslation();
  const id = useId();
  const fieldRef = useRef(null);
  const caretRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const { display, tokens } = projectStoryEditorText(value, context);
  const Field = rows ? "textarea" : "input";

  useLayoutEffect(() => {
    const caret = caretRef.current;
    if (caret === null) return;
    caretRef.current = null;
    const field = fieldRef.current;
    if (document.activeElement === field) {
      const position = getStoryEditorCaret(tokens, caret);
      field.setSelectionRange(position, position);
    }
  });

  function handleChange(event) {
    const field = event.currentTarget;
    const caret = field.selectionStart;
    if (field.value === display) return;
    const change = getStoryEditorChange(display, field.value, caret);
    const next = replaceStoryEditorRange(value, tokens, change.start, change.end, change.replacement);
    caretRef.current = next.caret;
    onValueChange(next.raw);

    // Update the menu only when the user types @ or continues typing a variable name.
    const trigger = field.value.slice(0, caret).match(/(@[\w.]*)$/);
    const query = trigger?.[1].slice(1).toLowerCase();
    const options = trigger && variables.filter(({ path }) => path.toLowerCase().includes(query));
    const unchanged = projectStoryEditorText(next.raw, context).display === field.value;
    setMenu(unchanged && options?.length && (menu || change.replacement.includes("@"))
      ? { start: caret - trigger[1].length, end: caret, options, active: 0 } : null);
  }

  function handleInsert(variable) {
    const separator = /^[\w]|^\.\w/.test(display.slice(menu.end)) ? " " : "";
    const next = replaceStoryEditorRange(value, tokens, menu.start, menu.end, `@${variable.path}${separator}`);
    fieldRef.current.focus();
    caretRef.current = next.caret;
    onValueChange(next.raw);
    setMenu(null);
  }

  function handleKeyDown(event) {
    if (!menu || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      setMenu(null);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setMenu({ ...menu, active: (menu.active + direction + menu.options.length) % menu.options.length });
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleInsert(menu.options[menu.active]);
    } else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      setMenu(null);
    }
  }

  return (
    <div className={`story-variable-field ${className || ""}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null);
    }}>
      <label htmlFor={id}>{label}</label>
      <Field id={id} ref={fieldRef} className="story-preview-field" rows={rows} placeholder={placeholder}
        value={display} onChange={handleChange} onKeyDown={handleKeyDown} onClick={() => setMenu(null)}
        aria-controls={menu ? `${id}-variables` : undefined}
        role={rows ? undefined : "combobox"}
        aria-expanded={rows ? undefined : Boolean(menu)}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={menu ? `${id}-variable-${menu.active}` : undefined}
      />
      {menu && <div id={`${id}-variables`} role="listbox" aria-label={t("Story variables")} className="story-variable-menu">
        {menu.options.map((variable, index) => (
          <div key={variable.path} id={`${id}-variable-${index}`} role="option" aria-selected={index === menu.active}
            className="story-editor-menu-option" onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleInsert(variable)}>
            <strong>{t(variable.label)}</strong>
            <small>{resolveStoryVariable(variable.path, context) || `@${variable.path}`}</small>
          </div>
        ))}
      </div>}
    </div>
  );
}
