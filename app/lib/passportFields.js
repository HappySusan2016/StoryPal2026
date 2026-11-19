/* Legacy communication passport field definitions and form conversion. Leave the hidden avatar untouched on save. */
export const passportGroups = [
  [
    "pronouns",
    "Pronouns",
    [
      [
        "subject",
        "Subject (they)"
      ],
      [
        "object",
        "Object (them)"
      ],
      [
        "possessiveAdjective",
        "Poss. adj. (their)"
      ],
      [
        "possessivePronoun",
        "Poss. pron. (theirs)"
      ]
    ]
  ],
  [
    "communication",
    "Communication",
    [
      [
        "comprehensionLevel",
        "Comprehension level"
      ],
      [
        "latency",
        "Latency"
      ],
      [
        "yesNoConventions",
        "Yes/No conventions"
      ],
      [
        "dontUnderstandSignals",
        "Signals for not understanding"
      ]
    ]
  ],
  [
    "sensory",
    "Sensory",
    [
      [
        "sensitivities",
        "Sensitivities"
      ],
      [
        "triggers",
        "Triggers"
      ],
      [
        "strategies",
        "Sensory strategies"
      ],
      [
        "safeWordsCues",
        "Safe words / cues"
      ]
    ]
  ],
  [
    "interaction",
    "Interaction",
    [
      [
        "reinforcementPreferences",
        "Reinforcement preferences"
      ],
      [
        "interests",
        "Interests"
      ],
      [
        "dosDonts",
        "Dos / Don’ts"
      ],
      [
        "identityLanguage",
        "Identity language"
      ],
      [
        "culturalContext",
        "Cultural context"
      ]
    ]
  ],
  [
    "accessSafety",
    "Access & Safety",
    [
      [
        "accessibilityNeeds",
        "Accessibility needs"
      ],
      [
        "deescalationStrategies",
        "De-escalation strategies"
      ],
      [
        "caregiverNotes",
        "Caregiver notes"
      ],
      [
        "consentScope",
        "Consent scope"
      ]
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

/** Merge the legacy form into an existing profile while preserving hidden fields and unrecognized communication methods. */
export function updatePassportFromForm(existing, data, id) {
  const next = { ...existing, id: existing?.id || id, childName: data.get("childName").trim(), age: data.get("age").trim() };
  for (const [group, , fields] of passportGroups) {
    next[group] = { ...existing?.[group] };
    for (const [field] of fields) next[group][field] = data.has(`${group}.${field}`)
      ? data.get(`${group}.${field}`).trim()
      : existing?.[group]?.[field] ?? "";
  }
  const knownModalities = ["AAC", "PECS", "Gestures", "Sign", "Verbal"];
  // The basic form omits communication fields, so preserve their values when they are absent from the submission.
  next.communication.modalities = data.has("communication.comprehensionLevel")
    ? [...(existing?.communication?.modalities || []).filter(value => !knownModalities.includes(value)), ...data.getAll("modalities")]
    : existing?.communication?.modalities || [];
  return next;
}
