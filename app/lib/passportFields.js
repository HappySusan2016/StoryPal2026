/* Child profile field definitions and form data conversion. */
// Each field defines its name, label, placeholder, and default text for a blank submission, in that order.
export const passportGroups = [
  [
    "pronouns",
    "Pronouns",
    [
      ["subject", "Subject (they)", "Subject (they)", "they"],
      ["object", "Object (them)", "Object (them)", "them"],
      ["possessiveAdjective", "Poss. adj. (their)", "Poss. adj. (their)", "their"],
      ["possessivePronoun", "Poss. pron. (theirs)", "Poss. pron. (theirs)", "theirs"],
    ]
  ],
  [
    "communication",
    "Communication",
    [
      ["comprehensionLevel", "Comprehension level", "e.g., simple 1-step instructions", "Understands simple 1-step instructions."],
      ["latency", "Latency", "e.g., needs 5–10 seconds", "Needs 5–10 seconds to respond."],
      ["yesNoConventions", "Yes/No conventions", "e.g., nodding, thumbs up, AAC buttons", "Nods for yes; shakes head for no."],
      ["dontUnderstandSignals", "Signals for not understanding", "e.g., covers ears, says 'break'", "Covers ears or says 'break' when overwhelmed."],
    ]
  ],
  [
    "sensory",
    "Sensory",
    [
      ["sensitivities", "Sensitivities", "e.g., sound, light, touch", "Sensitive to loud sounds and bright lights."],
      ["triggers", "Triggers", "e.g., long waits, sudden noises", "Sudden noises and crowded spaces."],
      ["strategies", "Sensory strategies", "e.g., deep pressure, breaks", "Deep pressure, quiet break, headphones."],
      ["safeWordsCues", "Safe words / cues", "e.g., 'break' or visual card", "Says 'break' and shows break card."],
    ]
  ],
  [
    "interaction",
    "Interaction",
    [
      ["reinforcementPreferences", "Reinforcement preferences", "e.g., stickers, tokens", "Sticker reward and cheerful praise."],
      ["interests", "Interests", "e.g., dinosaurs, trains", "Loves dinosaurs and animal stories."],
      ["dosDonts", "Dos / Don’ts", "e.g., do: offer choices; don't: rush", "Do: offer choices and visuals; Don't: rush or raise voice."],
      ["identityLanguage", "Identity language", "e.g., uses identity-first language 'autistic'", "Prefers identity-first language."],
      ["culturalContext", "Cultural context", "e.g., bilingual (English/Spanish)", "Bilingual (English/Spanish), values gentle tone."],
    ]
  ],
  [
    "accessSafety",
    "Access & Safety",
    [
      ["accessibilityNeeds", "Accessibility needs", "e.g., visual schedule, AAC", "Visual schedule and AAC available."],
      ["deescalationStrategies", "De-escalation strategies", "e.g., quiet corner, breathing", "Quiet corner, three sparkle breaths."],
      ["caregiverNotes", "Caregiver notes", "e.g., bedtime changes this week", "New routine this week; may be tired."],
      ["consentScope", "Consent scope", "e.g., share passport with teacher", "Consent to share passport with teacher and therapist."],
    ]
  ]
];

/** Check for duplicate names on creation or rename. Existing profiles can keep their names when other fields change. */
export function hasDuplicateChildName(passport, passports, existing) {
  const nameKey = (name) => (name || "").trim().toLowerCase().normalize("NFC");
  const name = nameKey(passport.childName);
  if (existing && nameKey(existing.childName) === name) return false;
  return passports.some(item => item.id !== passport.id && nameKey(item.childName) === name);
}

/** Merge form data, filling defaults for submitted blank detail fields and preserving unsubmitted fields. */
export function updatePassportFromForm(existing, data, id) {
  const next = { ...existing, id: existing?.id || id, childName: data.get("childName").trim(), age: data.get("age").trim() };
  for (const [group, , fields] of passportGroups) {
    next[group] = { ...existing?.[group] };
    for (const [field, , , example] of fields) next[group][field] = data.has(`${group}.${field}`)
      ? data.get(`${group}.${field}`).trim() || example
      : existing?.[group]?.[field] ?? "";
  }
  const knownModalities = ["AAC", "PECS", "Gestures", "Sign", "Verbal"];
  // The basic form omits communication fields, so preserve their values when they are absent from the submission.
  next.communication.modalities = data.has("communication.comprehensionLevel")
    ? [...(existing?.communication?.modalities || []).filter(value => !knownModalities.includes(value)), ...data.getAll("modalities")]
    : existing?.communication?.modalities || [];
  return next;
}
