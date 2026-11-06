"use client";

import { useState, useMemo } from "react";

const PASSPORTS_KEY = "storypal.passports";

function savePassportsToStorage(passports) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PASSPORTS_KEY, JSON.stringify(passports));
}

function serializeModalities(state) {
  return Object.entries(state)
    .filter(([, v]) => !!v)
    .map(([k]) => k);
}

export default function CommunicationPassports({
  passports,
  selectedPassportId,
  onPassportChange,
  onSelectedPassportChange,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cpName, setCpName] = useState("");
  const [cpAge, setCpAge] = useState("");
  const [cpAvatar, setCpAvatar] = useState("bird");
  const [cpPronouns, setCpPronouns] = useState({
    subject: "",
    object: "",
    possessiveAdjective: "",
    possessivePronoun: "",
  });
  const [cpModalities, setCpModalities] = useState({
    AAC: false,
    PECS: false,
    Gestures: false,
    Sign: false,
    Verbal: false,
  });
  const [cpCommunication, setCpCommunication] = useState({
    comprehensionLevel: "",
    latency: "",
    yesNoConventions: "",
    dontUnderstandSignals: "",
  });
  const [cpSensory, setCpSensory] = useState({
    sensitivities: "",
    triggers: "",
    strategies: "",
    safeWordsCues: "",
  });
  const [cpInteraction, setCpInteraction] = useState({
    reinforcementPreferences: "",
    interests: "",
    dosDonts: "",
    identityLanguage: "",
    culturalContext: "",
  });
  const [cpAccess, setCpAccess] = useState({
    accessibilityNeeds: "",
    deescalationStrategies: "",
    caregiverNotes: "",
    consentScope: "",
  });

  const selectedPassport = useMemo(
    () => passports.find((p) => p.id === selectedPassportId) || null,
    [passports, selectedPassportId]
  );

  const resetForm = () => {
    setCpName("");
    setCpAge("");
    setCpAvatar("bird");
    setCpPronouns({
      subject: "",
      object: "",
      possessiveAdjective: "",
      possessivePronoun: "",
    });
    setCpModalities({
      AAC: false,
      PECS: false,
      Gestures: false,
      Sign: false,
      Verbal: false,
    });
    setCpCommunication({
      comprehensionLevel: "",
      latency: "",
      yesNoConventions: "",
      dontUnderstandSignals: "",
    });
    setCpSensory({
      sensitivities: "",
      triggers: "",
      strategies: "",
      safeWordsCues: "",
    });
    setCpInteraction({
      reinforcementPreferences: "",
      interests: "",
      dosDonts: "",
      identityLanguage: "",
      culturalContext: "",
    });
    setCpAccess({
      accessibilityNeeds: "",
      deescalationStrategies: "",
      caregiverNotes: "",
      consentScope: "",
    });
    setEditingId(null);
  };

  const handleSave = () => {
    if (!cpName.trim()) return;
    const passport = {
      id: editingId || `${Date.now()}`,
      childName: cpName.trim(),
      age: cpAge.trim(),
      avatar: cpAvatar || "bird",
      pronouns: { ...cpPronouns },
      communication: {
        modalities: serializeModalities(cpModalities),
        comprehensionLevel: cpCommunication.comprehensionLevel,
        latency: cpCommunication.latency,
        yesNoConventions: cpCommunication.yesNoConventions,
        dontUnderstandSignals: cpCommunication.dontUnderstandSignals,
      },
      sensory: { ...cpSensory },
      interaction: { ...cpInteraction },
      accessSafety: { ...cpAccess },
    };
    const next = [...passports];
    const idx = next.findIndex((p) => p.id === passport.id);
    if (idx >= 0) next[idx] = passport;
    else next.unshift(passport);

    savePassportsToStorage(next);
    onPassportChange(next);
    onSelectedPassportChange(passport.id);
    setShowForm(false);
    resetForm();
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setCpName(p.childName || "");
    setCpAge(p.age || "");
    setCpAvatar(p.avatar || "bird");
    setCpPronouns({
      subject: p.pronouns?.subject || "",
      object: p.pronouns?.object || "",
      possessiveAdjective: p.pronouns?.possessiveAdjective || "",
      possessivePronoun: p.pronouns?.possessivePronoun || "",
    });
    const modalities = p.communication?.modalities || [];
    setCpModalities({
      AAC: modalities.includes("AAC"),
      PECS: modalities.includes("PECS"),
      Gestures: modalities.includes("Gestures"),
      Sign: modalities.includes("Sign"),
      Verbal: modalities.includes("Verbal"),
    });
    setCpCommunication({
      comprehensionLevel: p.communication?.comprehensionLevel || "",
      latency: p.communication?.latency || "",
      yesNoConventions: p.communication?.yesNoConventions || "",
      dontUnderstandSignals: p.communication?.dontUnderstandSignals || "",
    });
    setCpSensory({
      sensitivities: p.sensory?.sensitivities || "",
      triggers: p.sensory?.triggers || "",
      strategies: p.sensory?.strategies || "",
      safeWordsCues: p.sensory?.safeWordsCues || "",
    });
    setCpInteraction({
      reinforcementPreferences: p.interaction?.reinforcementPreferences || "",
      interests: p.interaction?.interests || "",
      dosDonts: p.interaction?.dosDonts || "",
      identityLanguage: p.interaction?.identityLanguage || "",
      culturalContext: p.interaction?.culturalContext || "",
    });
    setCpAccess({
      accessibilityNeeds: p.accessSafety?.accessibilityNeeds || "",
      deescalationStrategies: p.accessSafety?.deescalationStrategies || "",
      caregiverNotes: p.accessSafety?.caregiverNotes || "",
      consentScope: p.accessSafety?.consentScope || "",
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    const next = passports.filter((p) => p.id !== id);
    savePassportsToStorage(next);
    onPassportChange(next);
    if (selectedPassportId === id) {
      onSelectedPassportChange(next[0]?.id || null);
    }
    if (editingId === id) {
      resetForm();
      setShowForm(false);
    }
  };

  return (
    <section className="mt-6 bg-white rounded-2xl p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col justify-between mb-4">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Communication Passports
        </h2>
        <p className="mt-2 text-zinc-700">
          First, create a Communication Passport for your child. Then design
          personalized story modules.
        </p>
      </div>

      {/* Select child at the top */}
      <div className="flex items-center gap-3 mb-6">
        <label className="block text-sm text-zinc-700 font-semibold">
          Select child:
        </label>
        <select
          value={selectedPassportId || ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "create-new") {
              resetForm();
              setShowForm(true);
              e.target.value = "";
            } else {
              onSelectedPassportChange(value || null);
            }
          }}
          className="flex-1 max-w-xs bg-white border border-zinc-200 rounded-xl py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 transition-all"
        >
          <option value="">— Choose a child —</option>
          {passports.map((p) => (
            <option key={p.id} value={p.id}>
              {p.childName}
            </option>
          ))}
          <option value="create-new">+ Create New Passport</option>
        </select>
      </div>

      {/* Selected passport display */}
      {selectedPassport ? (
        <div className="flex items-center justify-start gap-6 mb-6 min-h-[300px]">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-green-700 w-46 h-72 rounded-4xl">
              <img
                src={
                  selectedPassport.avatar === "elephant"
                    ? "/elephant.png"
                    : selectedPassport.avatar === "giraffe"
                    ? "/jiraffe.png"
                    : "/bird.png"
                }
                alt={selectedPassport.avatar}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">
                {selectedPassport.childName}
              </h3>
              {selectedPassport.age && (
                <p className="text-lg text-zinc-700 mb-1">
                  Age: {selectedPassport.age}
                </p>
              )}
              {selectedPassport.communication?.modalities &&
                selectedPassport.communication.modalities.length > 0 && (
                  <p className="text-sm text-zinc-600 mb-1">
                    Communication:{" "}
                    {selectedPassport.communication.modalities.join(", ")}
                  </p>
                )}
              {selectedPassport.interaction?.interests && (
                <p className="text-sm text-zinc-600 mb-1">
                  Interests: {selectedPassport.interaction.interests}
                </p>
              )}
              {selectedPassport.sensory?.sensitivities && (
                <p className="text-sm text-zinc-600 mb-4">
                  Sensory: {selectedPassport.sensory.sensitivities}
                </p>
              )}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => handleEdit(selectedPassport)}
                  data-telemetry="parent_passport_edit"
                  className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedPassport.id)}
                  data-telemetry="parent_passport_delete"
                  className="rounded-xl px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-6 rounded-xl border border-zinc-200 bg-zinc-50 min-h-[300px] flex items-center">
          <p className="text-zinc-600">
            No child selected. Select a child or create a new passport.
          </p>
        </div>
      )}

      {/* Passport Form Section */}
      {showForm && (
        <section className="mt-6 rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
          <div className="rounded-xl border border-zinc-200 p-4 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">
                {editingId ? "Edit Passport" : "New Passport"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-lg px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Choose avatar
                </label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {["bird", "giraffe", "elephant"].map((a) => {
                    const meta =
                      a === "elephant"
                        ? {
                            bg: "bg-[#4f87d8]",
                            src: "/elephant.png",
                            label: "Elephant",
                          }
                        : a === "giraffe"
                        ? {
                            bg: "bg-[#f97316]",
                            src: "/jiraffe.png",
                            label: "Giraffe",
                          }
                        : {
                            bg: "bg-[#34a853]",
                            src: "/bird.png",
                            label: "Bird",
                          };
                    const isSel = cpAvatar === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setCpAvatar(a)}
                        className={`rounded-xl px-3 py-4 border ${
                          isSel ? "border-zinc-900" : "border-zinc-200"
                        } ${
                          meta.bg
                        } text-white flex flex-col items-center justify-center gap-2`}
                        title={meta.label}
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/60 border border-white/50">
                          <img
                            src={meta.src}
                            alt={meta.label}
                            className="w-16 h-16 object-cover"
                          />
                        </div>
                        <div className="text-sm font-semibold">
                          {meta.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-700">
                  Child name
                </label>
                <input
                  value={cpName}
                  onChange={(e) => setCpName(e.target.value)}
                  placeholder="e.g., Alex"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-700">
                  Age (optional)
                </label>
                <input
                  value={cpAge}
                  onChange={(e) => setCpAge(e.target.value)}
                  placeholder="e.g., 6"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">Pronouns</label>
                <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input
                    value={cpPronouns.subject}
                    onChange={(e) =>
                      setCpPronouns({ ...cpPronouns, subject: e.target.value })
                    }
                    onFocus={() => {
                      if (!cpPronouns.subject) {
                        setCpPronouns({ ...cpPronouns, subject: "they" });
                      }
                    }}
                    placeholder="Subject (they)"
                    className="bg-white/90 border border-zinc-200 rounded-xl px-3 py-2"
                  />
                  <input
                    value={cpPronouns.object}
                    onChange={(e) =>
                      setCpPronouns({ ...cpPronouns, object: e.target.value })
                    }
                    onFocus={() => {
                      if (!cpPronouns.object) {
                        setCpPronouns({ ...cpPronouns, object: "them" });
                      }
                    }}
                    placeholder="Object (them)"
                    className="bg-white/90 border border-zinc-200 rounded-xl px-3 py-2"
                  />
                  <input
                    value={cpPronouns.possessiveAdjective}
                    onChange={(e) =>
                      setCpPronouns({
                        ...cpPronouns,
                        possessiveAdjective: e.target.value,
                      })
                    }
                    onFocus={() => {
                      if (!cpPronouns.possessiveAdjective) {
                        setCpPronouns({
                          ...cpPronouns,
                          possessiveAdjective: "their",
                        });
                      }
                    }}
                    placeholder="Poss. adj. (their)"
                    className="bg-white/90 border border-zinc-200 rounded-xl px-3 py-2"
                  />
                  <input
                    value={cpPronouns.possessivePronoun}
                    onChange={(e) =>
                      setCpPronouns({
                        ...cpPronouns,
                        possessivePronoun: e.target.value,
                      })
                    }
                    onFocus={() => {
                      if (!cpPronouns.possessivePronoun) {
                        setCpPronouns({
                          ...cpPronouns,
                          possessivePronoun: "theirs",
                        });
                      }
                    }}
                    placeholder="Poss. pron. (theirs)"
                    className="bg-white/90 border border-zinc-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Communication Modalities
                </label>
                <div className="mt-1 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  {["AAC", "PECS", "Gestures", "Sign", "Verbal"].map((key) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cpModalities[key]}
                        onChange={(e) =>
                          setCpModalities({
                            ...cpModalities,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      <span>{key}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-700">
                  Comprehension level
                </label>
                <input
                  value={cpCommunication.comprehensionLevel}
                  onChange={(e) =>
                    setCpCommunication({
                      ...cpCommunication,
                      comprehensionLevel: e.target.value,
                    })
                  }
                  onFocus={() => {
                    if (!cpCommunication.comprehensionLevel) {
                      setCpCommunication({
                        ...cpCommunication,
                        comprehensionLevel:
                          "Understands simple 1-step instructions.",
                      });
                    }
                  }}
                  placeholder="e.g., simple 1-step instructions"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-700">Latency</label>
                <input
                  value={cpCommunication.latency}
                  onChange={(e) =>
                    setCpCommunication({
                      ...cpCommunication,
                      latency: e.target.value,
                    })
                  }
                  onFocus={() => {
                    if (!cpCommunication.latency) {
                      setCpCommunication({
                        ...cpCommunication,
                        latency: "Needs 5–10 seconds to respond.",
                      });
                    }
                  }}
                  placeholder="e.g., needs 5–10 seconds"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Yes/No conventions
                </label>
                <input
                  value={cpCommunication.yesNoConventions}
                  onChange={(e) =>
                    setCpCommunication({
                      ...cpCommunication,
                      yesNoConventions: e.target.value,
                    })
                  }
                  onFocus={() => {
                    if (!cpCommunication.yesNoConventions) {
                      setCpCommunication({
                        ...cpCommunication,
                        yesNoConventions: "Nods for yes; shakes head for no.",
                      });
                    }
                  }}
                  placeholder="e.g., nodding, thumbs up, AAC buttons"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  "Don't understand" signals
                </label>
                <input
                  value={cpCommunication.dontUnderstandSignals}
                  onChange={(e) =>
                    setCpCommunication({
                      ...cpCommunication,
                      dontUnderstandSignals: e.target.value,
                    })
                  }
                  onFocus={() => {
                    if (!cpCommunication.dontUnderstandSignals) {
                      setCpCommunication({
                        ...cpCommunication,
                        dontUnderstandSignals:
                          "Covers ears or says 'break' when overwhelmed.",
                      });
                    }
                  }}
                  placeholder="e.g., covers ears, says 'break'"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Sensory sensitivities
                </label>
                <textarea
                  value={cpSensory.sensitivities}
                  onChange={(e) =>
                    setCpSensory({
                      ...cpSensory,
                      sensitivities: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpSensory.sensitivities) {
                      setCpSensory({
                        ...cpSensory,
                        sensitivities:
                          "Sensitive to loud sounds and bright lights.",
                      });
                    }
                  }}
                  placeholder="e.g., sound, light, touch"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">Triggers</label>
                <textarea
                  value={cpSensory.triggers}
                  onChange={(e) =>
                    setCpSensory({ ...cpSensory, triggers: e.target.value })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpSensory.triggers) {
                      setCpSensory({
                        ...cpSensory,
                        triggers: "Sudden noises and crowded spaces.",
                      });
                    }
                  }}
                  placeholder="e.g., long waits, sudden noises"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Regulation strategies
                </label>
                <textarea
                  value={cpSensory.strategies}
                  onChange={(e) =>
                    setCpSensory({ ...cpSensory, strategies: e.target.value })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpSensory.strategies) {
                      setCpSensory({
                        ...cpSensory,
                        strategies: "Deep pressure, quiet break, headphones.",
                      });
                    }
                  }}
                  placeholder="e.g., deep pressure, breaks"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Safe words / cues
                </label>
                <textarea
                  value={cpSensory.safeWordsCues}
                  onChange={(e) =>
                    setCpSensory({
                      ...cpSensory,
                      safeWordsCues: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpSensory.safeWordsCues) {
                      setCpSensory({
                        ...cpSensory,
                        safeWordsCues: "Says 'break' and shows break card.",
                      });
                    }
                  }}
                  placeholder="e.g., 'break' or visual card"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Reinforcement preferences
                </label>
                <textarea
                  value={cpInteraction.reinforcementPreferences}
                  onChange={(e) =>
                    setCpInteraction({
                      ...cpInteraction,
                      reinforcementPreferences: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpInteraction.reinforcementPreferences) {
                      setCpInteraction({
                        ...cpInteraction,
                        reinforcementPreferences:
                          "Sticker reward and cheerful praise.",
                      });
                    }
                  }}
                  placeholder="e.g., stickers, tokens"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">Interests</label>
                <textarea
                  value={cpInteraction.interests}
                  onChange={(e) =>
                    setCpInteraction({
                      ...cpInteraction,
                      interests: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpInteraction.interests) {
                      setCpInteraction({
                        ...cpInteraction,
                        interests: "Loves dinosaurs and animal stories.",
                      });
                    }
                  }}
                  placeholder="e.g., dinosaurs, trains"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Do / Don't
                </label>
                <textarea
                  value={cpInteraction.dosDonts}
                  onChange={(e) =>
                    setCpInteraction({
                      ...cpInteraction,
                      dosDonts: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpInteraction.dosDonts) {
                      setCpInteraction({
                        ...cpInteraction,
                        dosDonts:
                          "Do: offer choices and visuals; Don't: rush or raise voice.",
                      });
                    }
                  }}
                  placeholder="e.g., do: offer choices; don't: rush"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Identity language
                </label>
                <textarea
                  value={cpInteraction.identityLanguage}
                  onChange={(e) =>
                    setCpInteraction({
                      ...cpInteraction,
                      identityLanguage: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpInteraction.identityLanguage) {
                      setCpInteraction({
                        ...cpInteraction,
                        identityLanguage: "Prefers identity-first language.",
                      });
                    }
                  }}
                  placeholder="e.g., uses identity-first language 'autistic'"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Cultural / linguistic context
                </label>
                <textarea
                  value={cpInteraction.culturalContext}
                  onChange={(e) =>
                    setCpInteraction({
                      ...cpInteraction,
                      culturalContext: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpInteraction.culturalContext) {
                      setCpInteraction({
                        ...cpInteraction,
                        culturalContext:
                          "Bilingual (English/Spanish), values gentle tone.",
                      });
                    }
                  }}
                  placeholder="e.g., bilingual (English/Spanish)"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Accessibility needs
                </label>
                <textarea
                  value={cpAccess.accessibilityNeeds}
                  onChange={(e) =>
                    setCpAccess({
                      ...cpAccess,
                      accessibilityNeeds: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpAccess.accessibilityNeeds) {
                      setCpAccess({
                        ...cpAccess,
                        accessibilityNeeds:
                          "Visual schedule and AAC available.",
                      });
                    }
                  }}
                  placeholder="e.g., visual schedule, AAC"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  De-escalation strategies
                </label>
                <textarea
                  value={cpAccess.deescalationStrategies}
                  onChange={(e) =>
                    setCpAccess({
                      ...cpAccess,
                      deescalationStrategies: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpAccess.deescalationStrategies) {
                      setCpAccess({
                        ...cpAccess,
                        deescalationStrategies:
                          "Quiet corner, three sparkle breaths.",
                      });
                    }
                  }}
                  placeholder="e.g., quiet corner, breathing"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Caregiver notes
                </label>
                <textarea
                  value={cpAccess.caregiverNotes}
                  onChange={(e) =>
                    setCpAccess({
                      ...cpAccess,
                      caregiverNotes: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpAccess.caregiverNotes) {
                      setCpAccess({
                        ...cpAccess,
                        caregiverNotes: "New routine this week; may be tired.",
                      });
                    }
                  }}
                  placeholder="e.g., bedtime changes this week"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-700">
                  Consent scope
                </label>
                <textarea
                  value={cpAccess.consentScope}
                  onChange={(e) =>
                    setCpAccess({
                      ...cpAccess,
                      consentScope: e.target.value,
                    })
                  }
                  rows={2}
                  onFocus={() => {
                    if (!cpAccess.consentScope) {
                      setCpAccess({
                        ...cpAccess,
                        consentScope:
                          "Consent to share passport with teacher and therapist.",
                      });
                    }
                  }}
                  placeholder="e.g., share passport with teacher"
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!cpName.trim()}
                className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3] disabled:opacity-50"
              >
                {editingId ? "Update Passport" : "Save Passport"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-xl px-4 py-2 bg-zinc-100 hover:bg-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
