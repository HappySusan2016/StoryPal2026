"use client";

import { useTranslation } from "../hooks/useTranslation";
import { passportGroups } from "../lib/passportFields";

/** @module Child profile form */
export default function PassportFields({ passport, basicOnly = false }) {
  const { t } = useTranslation();
  const prefix = passport?.id || "new";

  /** Keep only digits when the age is typed or pasted during profile creation. */
  function handleAgeInput(event) {
    const input = event.currentTarget;
    const digits = input.value.replace(/[^0-9]/g, "");
    if (input.value !== digits) input.value = digits;
  }

  /** Share inputs between the home and details pages, with each input associated with its label. */
  function renderInput(name, label, value, placeholder, { required = false } = {}) {
    const id = `${prefix}-${name}`;
    const isNewProfileAge = basicOnly && name === "age";
    return (
      <div key={name}>
        <label htmlFor={id}>{t(label)}</label>
        <input
          id={id}
          name={name}
          defaultValue={value || ""}
          placeholder={t(placeholder)}
          required={required}
          inputMode={isNewProfileAge ? "numeric" : undefined}
          pattern={isNewProfileAge ? "[0-9]+" : undefined}
          onInput={isNewProfileAge ? handleAgeInput : undefined}
        />
      </div>
    );
  }

  return (
    <>
      {renderInput("childName", "Child name", passport?.childName, "e.g., Alex", { required: true })}
      {renderInput("age", "Age", passport?.age, "e.g., 6", { required: true })}
      {!basicOnly && (
        <fieldset aria-describedby={`${prefix}-modalities-hint`}>
          <legend>{t("Communication Modalities")}</legend>
          <p id={`${prefix}-modalities-hint`}>{t("Select at least one communication modality.")}</p>
          {["AAC", "PECS", "Gestures", "Sign", "Verbal"].map((value) => (
            <label className="check" key={value}>
              <input
                type="checkbox"
                name="modalities"
                value={value}
                defaultChecked={passport?.communication?.modalities?.includes(value)}
              />
              <span>{t(value)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {!basicOnly && passportGroups.map(([group, label, fields]) => (
        <details key={group}>
          <summary>{t(label)}</summary>
          <fieldset>
            {fields.map(([field, fieldLabel, placeholder]) =>
              renderInput(`${group}.${field}`, fieldLabel, passport?.[group]?.[field], placeholder),
            )}
          </fieldset>
        </details>
      ))}
    </>
  );
}
