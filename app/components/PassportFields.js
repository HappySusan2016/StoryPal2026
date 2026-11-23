"use client";

import { useTranslation } from "../hooks/useTranslation";
import { passportGroups } from "../lib/passportFields";

/** @module Communication passport form */
export default function PassportFields({ passport, basicOnly = false }) {
  const { t } = useTranslation();
  const prefix = passport?.id || "new";

  /** Fill in the example only when an empty input receives focus. FormData reads the current value on submission. */
  function handleFillExample(event, example) {
    const input = event.currentTarget;
    if (input.value === "") input.value = example;
  }

  /** Keep only digits in the age field for new profiles, whether typed or pasted. */
  function handleAgeInput(event) {
    const input = event.currentTarget;
    const digits = input.value.replace(/[^0-9]/g, "");
    if (input.value !== digits) input.value = digits;
  }

  /** Associate inputs with their labels and keep the same field structure in the creation and details forms. */
  function renderInput(name, label, value, placeholder, { required = false, example } = {}) {
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
          pattern={isNewProfileAge ? "[0-9]*" : undefined}
          onInput={isNewProfileAge ? handleAgeInput : undefined}
          onFocus={example ? (event) => handleFillExample(event, example) : undefined}
        />
      </div>
    );
  }

  return (
    <>
      {renderInput("childName", "Child name", passport?.childName, "e.g., Alex", { required: true })}
      {renderInput("age", "Age (optional)", passport?.age, "e.g., 6")}
      {!basicOnly && passportGroups.map(([group, label, fields]) => (
        <details key={group}>
          <summary>{t(label)}</summary>
          <fieldset>
            {group === "communication" && (
              <fieldset>
                <legend>{t("Communication Modalities")}</legend>
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
            {fields.map(([field, fieldLabel, placeholder, example]) =>
              renderInput(`${group}.${field}`, fieldLabel, passport?.[group]?.[field], placeholder, { example }),
            )}
          </fieldset>
        </details>
      ))}
    </>
  );
}
