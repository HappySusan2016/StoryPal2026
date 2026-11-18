"use client";

import { useTranslation } from "../hooks/useTranslation";
import { passportGroups } from "../lib/passportFields";

/** @module Full profile form with avatar and other hidden data preserved on save */
export default function PassportFields({ passport, basicOnly = false }) {
  const { t } = useTranslation();
  const prefix = passport?.id || "new";

  /** Associate each field with a label so the dashboard and details page share the same form structure. */
  function renderInput(name, label, value, required = false) {
    const id = `${prefix}-${name}`;
    return (
      <div key={name}>
        <label htmlFor={id}>{t(label)}</label>
        <input id={id} name={name} defaultValue={value || ""} required={required} />
      </div>
    );
  }

  return (
    <>
      {renderInput("childName", "Child name", passport?.childName, true)}
      {renderInput("age", "Age (optional)", passport?.age)}
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
            {fields.map(([field, fieldLabel]) =>
              renderInput(`${group}.${field}`, fieldLabel, passport?.[group]?.[field]),
            )}
          </fieldset>
        </details>
      ))}
    </>
  );
}
