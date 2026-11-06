"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

function createEmptyStep(stepType) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (stepType === "doctor") {
    return { id, type: "doctor", message: "", imageUrl: "" };
  }
  if (stepType === "user-input") {
    return {
      id,
      type: "user-input",
      message: "",
      placeholder: "",
      imageUrl: "",
    };
  }
  return { id, type: "choice", message: "", options: [""], imageUrl: "" };
}

function getStepTypeLabel(stepType) {
  if (stepType === "doctor") return "Message for children";
  if (stepType === "user-input") return "Child's input";
  if (stepType === "choice") return "Multiple choice";
  return stepType;
}

// Helper function to convert file to base64 data URL
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Available template variables for insertion
const TEMPLATE_VARIABLES = [
  { label: "Child's Name", value: "@child.name" },
  { label: "Child's Age", value: "@child.age" },
  { label: "Pronoun (they/he/she)", value: "@child.pronouns.subject" },
  { label: "Pronoun (them/him/her)", value: "@child.pronouns.object" },
  {
    label: "Possessive (their/his/her)",
    value: "@child.pronouns.possessiveAdjective",
  },
  {
    label: "Possessive (theirs/his/hers)",
    value: "@child.pronouns.possessivePronoun",
  },
];

// Component for inserting template variables
function VariableSelector({ onInsert }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (value) => {
    onInsert(value);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200 flex items-center gap-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        Insert Variable
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[200px]">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable.value}
                type="button"
                onClick={() => handleSelect(variable.value)}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-zinc-700"
              >
                <div className="font-medium">{variable.label}</div>
                <div className="text-xs text-zinc-500">{variable.value}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ensureStepIds(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, idx) => {
    if (!step.id) {
      return {
        ...step,
        id: `step_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      };
    }
    return step;
  });
}

function validateModule(moduleDef) {
  if (!moduleDef.title.trim()) return false;
  if (!Array.isArray(moduleDef.steps) || moduleDef.steps.length === 0)
    return false;
  for (const step of moduleDef.steps) {
    if (step.type === "doctor" && !step.message.trim()) return false;
    if (step.type === "user-input" && !step.message.trim()) return false;
    if (step.type === "choice") {
      if (!step.message.trim()) return false;
      if (!Array.isArray(step.options) || step.options.length === 0)
        return false;
      if (step.options.some((o) => !o.trim())) return false;
    }
  }
  return true;
}

export default function StoryModules({
  passports,
  onSave,
  onPreview,
  initialData,
}) {
  const { t } = useTranslation();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRetryAt, setAiRetryAt] = useState(0);
  const [aiNow, setAiNow] = useState(0);
  const [title, setTitle] = useState(initialData?.title || "");
  const textareaRefs = useRef({});
  const [coverImage, setCoverImage] = useState(initialData?.coverImage || "");
  const [selectedPassportId, setSelectedPassportId] = useState(
    initialData?.childId || ""
  );
  const [steps, setSteps] = useState(
    Array.isArray(initialData?.steps) ? ensureStepIds(initialData.steps) : []
  );
  const [editingId, setEditingId] = useState(initialData?.id || null);
  const [activeStage, setActiveStage] = useState(1);
  const [sceneFont, setSceneFont] = useState(
    initialData?.fontPreset || "classic"
  );
  const [stageFraming, setStageFraming] = useState(
    initialData?.stageDesign?.framing || {
      focus: "greeting",
      scenario: "school",
      tone: "brave",
      parentGoal: "",
    }
  );
  const [stageImmersion, setStageImmersion] = useState(
    initialData?.stageDesign?.immersion || {
      feeling: "shy",
      coplay: "wave",
      imagery: "",
    }
  );
  const [stageReflection, setStageReflection] = useState(
    initialData?.stageDesign?.reflection || {
      tried: "",
      confidence: "Medium",
      comfort: "Medium",
    }
  );
  const [stageContinuity, setStageContinuity] = useState(
    initialData?.stageDesign?.continuity || {
      nextArc: "school-arc",
      cadence: "Every 2 days",
      badge: "bravery",
    }
  );

  // Update form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setCoverImage(initialData.coverImage || "");
      setSelectedPassportId(initialData.childId || "");
      setSteps(
        Array.isArray(initialData.steps) ? ensureStepIds(initialData.steps) : []
      );
      setEditingId(initialData.id || null);
      setSceneFont(initialData.fontPreset || "classic");
      setStageFraming(
        initialData.stageDesign?.framing || {
          focus: "greeting",
          scenario: "school",
          tone: "brave",
          parentGoal: "",
        }
      );
      setStageImmersion(
        initialData.stageDesign?.immersion || {
          feeling: "shy",
          coplay: "wave",
          imagery: "",
        }
      );
      setStageReflection(
        initialData.stageDesign?.reflection || {
          tried: "",
          confidence: "Medium",
          comfort: "Medium",
        }
      );
      setStageContinuity(
        initialData.stageDesign?.continuity || {
          nextArc: "school-arc",
          cadence: "Every 2 days",
          badge: "bravery",
        }
      );
    } else {
      // Clear form when initialData is null
      setTitle("");
      setCoverImage("");
      setSteps([]);
      setEditingId(null);
      setSceneFont("classic");
      setStageFraming({
        focus: "greeting",
        scenario: "school",
        tone: "brave",
        parentGoal: "",
      });
      setStageImmersion({
        feeling: "shy",
        coplay: "wave",
        imagery: "",
      });
      setStageReflection({
        tried: "",
        confidence: "Medium",
        comfort: "Medium",
      });
      setStageContinuity({
        nextArc: "school-arc",
        cadence: "Every 2 days",
        badge: "bravery",
      });
    }
  }, [initialData]);

  function buildStageContext() {
    return {
      framing: { ...stageFraming },
      immersion: { ...stageImmersion },
      reflection: { ...stageReflection },
      continuity: { ...stageContinuity },
    };
  }

  async function generateStepsFromStages() {
    setAiError("");
    if (aiRetryAt && Date.now() < aiRetryAt) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/generate-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: buildStageContext(),
          currentTitle: title || "",
          // Provide recent steps so the model continues instead of re-starting
          previousSteps: steps.slice(-6).map((s) => ({
            type: s.type,
            message: s.message,
            placeholder: s.placeholder,
            options: s.options,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          const retrySeconds =
            typeof data?.retryAfterSeconds === "number"
              ? data.retryAfterSeconds
              : 30;
          const until = Date.now() + Math.max(1, retrySeconds) * 1000;
          setAiRetryAt(until);
          setAiNow(Date.now());
          throw new Error(
            `Rate limited. Try again in ${Math.max(1, retrySeconds)}s.`
          );
        }
        throw new Error(data?.error || "Failed to generate steps.");
      }

      const incomingStep =
        data?.step && typeof data.step === "object" ? data.step : null;
      if (!incomingStep) throw new Error("No step returned.");

      // Optionally adopt the suggested title if user hasn't set one
      if (
        !title.trim() &&
        typeof data?.title === "string" &&
        data.title.trim()
      ) {
        setTitle(data.title.trim());
      }

      setSteps((prev) => {
        const s = incomingStep;
        const base = createEmptyStep(s.type);
        if (s.type === "doctor") {
          return [
            ...prev,
            { ...base, message: s.message || "", imageUrl: s.imageUrl || "" },
          ];
        }
        if (s.type === "user-input") {
          return [
            ...prev,
            {
              ...base,
              message: s.message || "",
              placeholder: s.placeholder || "",
              imageUrl: s.imageUrl || "",
            },
          ];
        }
        // choice
        return [
          ...prev,
          {
            ...base,
            message: s.message || "",
            options: Array.isArray(s.options) ? s.options : [""],
            imageUrl: s.imageUrl || "",
          },
        ];
      });
    } catch (e) {
      setAiError(e?.message || "Failed to generate steps.");
    } finally {
      setAiGenerating(false);
    }
  }

  useEffect(() => {
    if (!aiRetryAt) return;
    if (Date.now() >= aiRetryAt) return;
    const id = setInterval(() => setAiNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [aiRetryAt]);

  function addStep(stepType) {
    setSteps((prev) => [...prev, createEmptyStep(stepType)]);
  }

  function deleteStep(stepId) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  function moveStep(stepId, direction) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function updateStep(stepId, field, value) {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s))
    );
  }

  function insertVariableAtCursor(stepId, field, variable) {
    const element = textareaRefs.current[`${stepId}-${field}`];
    if (!element) {
      // If no element ref, just append to the end
      setSteps((prev) => {
        const step = prev.find((s) => s.id === stepId);
        if (step) {
          const currentValue = step[field] || "";
          return prev.map((s) =>
            s.id === stepId ? { ...s, [field]: currentValue + variable } : s
          );
        }
        return prev;
      });
      return;
    }

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const currentValue = element.value || "";
    const newValue =
      currentValue.slice(0, start) + variable + currentValue.slice(end);

    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, [field]: newValue } : s))
    );

    // Restore cursor position after state update
    setTimeout(() => {
      element.focus();
      const newCursorPos = start + variable.length;
      if (element.setSelectionRange) {
        element.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }

  function updateChoiceOption(stepId, optionIndex, value) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const options = Array.isArray(s.options) ? [...s.options] : [];
        options[optionIndex] = value;
        return { ...s, options };
      })
    );
  }

  function addChoiceOption(stepId) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const options = Array.isArray(s.options) ? [...s.options, ""] : [""];
        return { ...s, options };
      })
    );
  }

  function removeChoiceOption(stepId, optionIndex) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const options = (Array.isArray(s.options) ? s.options : []).filter(
          (_, i) => i !== optionIndex
        );
        return { ...s, options };
      })
    );
  }

  const modulePreview = useMemo(
    () => ({
      id: editingId || "preview",
      title: title || "Untitled Story",
      coverImage,
      steps,
      fontPreset: sceneFont || "classic",
    }),
    [editingId, title, coverImage, steps, sceneFont]
  );

  const isValid = validateModule(modulePreview);

  const handleSave = () => {
    const moduleDefinition = {
      id: editingId || `${Date.now()}`,
      title: title.trim(),
      coverImage: coverImage.trim(),
      steps,
      childId: selectedPassportId || null,
      stageDesign: {
        framing: { ...stageFraming },
        immersion: { ...stageImmersion },
        reflection: { ...stageReflection },
        continuity: { ...stageContinuity },
      },
      fontPreset: sceneFont || "classic",
    };
    if (!validateModule(moduleDefinition)) return;
    onSave(moduleDefinition);
  };

  const handlePreview = () => {
    onPreview(modulePreview);
  };

  return (
    <section className="mt-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm text-zinc-700">
                {t("title")}
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Calm Breathing Mission"
                className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
              />
            </div>
            <div>
              <label htmlFor="cover" className="block text-sm text-zinc-700">
                Cover Image (optional)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="cover"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="Paste an image link here (optional)"
                  className="flex-1 bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                />
                <label className="rounded-xl px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200 cursor-pointer transition-colors flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const dataURL = await fileToDataURL(file);
                          setCoverImage(dataURL);
                        } catch (error) {
                          console.error("Error uploading image:", error);
                          alert("Failed to upload image. Please try again.");
                        }
                      }
                      e.target.value = ""; // Reset input
                    }}
                  />
                </label>
              </div>
              {coverImage && (
                <div className="mt-2 relative w-full max-w-xs aspect-4/3 rounded-lg overflow-hidden border border-zinc-200">
                  <img
                    src={coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="passport-select"
                className="block text-sm text-zinc-700"
              >
                For Child (Passport)
              </label>
              <select
                id="passport-select"
                value={selectedPassportId}
                onChange={(e) => setSelectedPassportId(e.target.value)}
                className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
              >
                <option value="">All Children / General</option>
                {passports?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.childName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                Select which child this story is for. Leave as "All Children"
                for stories that work for everyone.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-700">Add scene:</span>
              <button
                type="button"
                onClick={() => addStep("doctor")}
                className="rounded-xl px-3 py-1.5 bg-[#5b217f] text-white hover:bg-[#7c2da3]"
              >
                Message
              </button>
              <button
                type="button"
                onClick={() => addStep("user-input")}
                className="rounded-xl px-3 py-1.5 bg-[#6b2a99] text-white hover:bg-[#7c2da3]"
              >
                Child's input
              </button>
              <button
                type="button"
                onClick={() => addStep("choice")}
                className="rounded-xl px-3 py-1.5 bg-[#7c2da3] text-white hover:bg-[#5b217f]"
              >
                Multiple choice
              </button>
            </div>

            <ol className="space-y-4">
              {steps.map((step, idx) => (
                <li
                  key={step.id || `step-${idx}-${step.type}`}
                  className="rounded-xl border border-zinc-200 p-4 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-600">
                      {getStepTypeLabel(step.type)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveStep(step.id, "up")}
                        className="rounded-lg px-2 py-1 text-zinc-700 hover:bg-zinc-100"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(step.id, "down")}
                        className="rounded-lg px-2 py-1 text-zinc-700 hover:bg-zinc-100"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStep(step.id)}
                        className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {step.type === "doctor" && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm text-zinc-700">
                            Message
                          </label>
                          <VariableSelector
                            onInsert={(variable) =>
                              insertVariableAtCursor(
                                step.id,
                                "message",
                                variable
                              )
                            }
                          />
                        </div>
                        <textarea
                          ref={(el) => {
                            textareaRefs.current[`${step.id}-message`] = el;
                          }}
                          value={step.message}
                          onChange={(e) =>
                            updateStep(step.id, "message", e.target.value)
                          }
                          rows={3}
                          placeholder="Write the message..."
                          className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-700">
                          Image (optional)
                        </label>
                        <div className="mt-1 flex gap-2">
                          <input
                            value={step.imageUrl || ""}
                            onChange={(e) =>
                              updateStep(step.id, "imageUrl", e.target.value)
                            }
                            placeholder="Paste an image link here (optional)"
                            className="flex-1 bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                          />
                          <label className="rounded-xl px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200 cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const dataURL = await fileToDataURL(file);
                                    updateStep(step.id, "imageUrl", dataURL);
                                  } catch (error) {
                                    console.error(
                                      "Error uploading image:",
                                      error
                                    );
                                    alert(
                                      "Failed to upload image. Please try again."
                                    );
                                  }
                                }
                                e.target.value = ""; // Reset input
                              }}
                            />
                          </label>
                        </div>
                        {step.imageUrl && (
                          <div className="mt-2 relative w-full max-w-xs aspect-4/3 rounded-lg overflow-hidden border border-zinc-200">
                            <img
                              src={step.imageUrl}
                              alt="Step preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {step.type === "user-input" && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm text-zinc-700">
                            Prompt
                          </label>
                          <VariableSelector
                            onInsert={(variable) =>
                              insertVariableAtCursor(
                                step.id,
                                "message",
                                variable
                              )
                            }
                          />
                        </div>
                        <textarea
                          ref={(el) => {
                            textareaRefs.current[`${step.id}-message`] = el;
                          }}
                          value={step.message}
                          onChange={(e) =>
                            updateStep(step.id, "message", e.target.value)
                          }
                          rows={2}
                          placeholder="Ask the child a question..."
                          className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm text-zinc-700">
                            Placeholder
                          </label>
                          <VariableSelector
                            onInsert={(variable) =>
                              insertVariableAtCursor(
                                step.id,
                                "placeholder",
                                variable
                              )
                            }
                          />
                        </div>
                        <input
                          ref={(el) => {
                            textareaRefs.current[`${step.id}-placeholder`] = el;
                          }}
                          value={step.placeholder || ""}
                          onChange={(e) =>
                            updateStep(step.id, "placeholder", e.target.value)
                          }
                          placeholder="Enter the child's response..."
                          className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-700">
                          Image (optional)
                        </label>
                        <div className="mt-1 flex gap-2">
                          <input
                            value={step.imageUrl || ""}
                            onChange={(e) =>
                              updateStep(step.id, "imageUrl", e.target.value)
                            }
                            placeholder="Paste an image link here (optional)"
                            className="flex-1 bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                          />
                          <label className="rounded-xl px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200 cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const dataURL = await fileToDataURL(file);
                                    updateStep(step.id, "imageUrl", dataURL);
                                  } catch (error) {
                                    console.error(
                                      "Error uploading image:",
                                      error
                                    );
                                    alert(
                                      "Failed to upload image. Please try again."
                                    );
                                  }
                                }
                                e.target.value = ""; // Reset input
                              }}
                            />
                          </label>
                        </div>
                        {step.imageUrl && (
                          <div className="mt-2 relative w-full max-w-xs aspect-4/3 rounded-lg overflow-hidden border border-zinc-200">
                            <img
                              src={step.imageUrl}
                              alt="Step preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {step.type === "choice" && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm text-zinc-700">
                            Question
                          </label>
                          <VariableSelector
                            onInsert={(variable) =>
                              insertVariableAtCursor(
                                step.id,
                                "message",
                                variable
                              )
                            }
                          />
                        </div>
                        <textarea
                          ref={(el) => {
                            textareaRefs.current[`${step.id}-message`] = el;
                          }}
                          value={step.message}
                          onChange={(e) =>
                            updateStep(step.id, "message", e.target.value)
                          }
                          rows={2}
                          placeholder="Ask the child to choose..."
                          className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm text-zinc-700">
                            Options
                          </label>
                          <button
                            type="button"
                            onClick={() => addChoiceOption(step.id)}
                            className="rounded-lg px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-sm"
                          >
                            Add option
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {(step.options || []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                value={opt}
                                onChange={(e) =>
                                  updateChoiceOption(step.id, i, e.target.value)
                                }
                                placeholder={`Choice ${i + 1}`}
                                className="flex-1 bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                              />
                              <button
                                type="button"
                                onClick={() => removeChoiceOption(step.id, i)}
                                className="rounded-lg px-2 py-2 text-red-600 hover:bg-red-50"
                                title="Remove option"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-700">
                          Image (optional)
                        </label>
                        <div className="mt-1 flex gap-2">
                          <input
                            value={step.imageUrl || ""}
                            onChange={(e) =>
                              updateStep(step.id, "imageUrl", e.target.value)
                            }
                            placeholder="Paste an image link here (optional)"
                            className="flex-1 bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                          />
                          <label className="rounded-xl px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200 cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const dataURL = await fileToDataURL(file);
                                    updateStep(step.id, "imageUrl", dataURL);
                                  } catch (error) {
                                    console.error(
                                      "Error uploading image:",
                                      error
                                    );
                                    alert(
                                      "Failed to upload image. Please try again."
                                    );
                                  }
                                }
                                e.target.value = ""; // Reset input
                              }}
                            />
                          </label>
                        </div>
                        {step.imageUrl && (
                          <div className="mt-2 relative w-full max-w-xs aspect-4/3 rounded-lg overflow-hidden border border-zinc-200">
                            <img
                              src={step.imageUrl}
                              alt="Step preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={!isValid}
                data-telemetry="parent_story_preview"
                className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3] disabled:opacity-50"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid}
                data-telemetry={
                  editingId ? "parent_story_update" : "parent_story_save"
                }
                className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3] disabled:opacity-50"
              >
                {editingId ? "Update story" : "Save story"}
              </button>
            </div>
          </div>
        </div>

        {/* Scene Design — NT‑UX Stages */}
        <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-900">
              Design Guide
            </h2>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { n: 1, label: "1. Framing" },
              { n: 2, label: "2. Immersion" },
              { n: 3, label: "3. Reflection" },
              { n: 4, label: "4. Continuity" },
            ].map((tab) => (
              <button
                key={tab.n}
                type="button"
                onClick={() => setActiveStage(tab.n)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  activeStage === tab.n
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {activeStage === 1 && (
              <div className="rounded-xl border border-zinc-200 p-4 bg-white space-y-4">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Stage 1 · Narrative Framing
                </h3>
                <p className="text-sm text-zinc-600">
                  Personalize the setup and align with today's goal.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Today's focus
                    </label>
                    <select
                      value={stageFraming.focus}
                      onChange={(e) =>
                        setStageFraming({
                          ...stageFraming,
                          focus: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="greeting">Greeting / Saying hello</option>
                      <option value="sharing">Sharing / Turn‑taking</option>
                      <option value="routine">Morning routine</option>
                      <option value="transitions">
                        Transitions: between activities
                      </option>
                      <option value="sensory">
                        Managing sensory surprises
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Scenario
                    </label>
                    <select
                      value={stageFraming.scenario}
                      onChange={(e) =>
                        setStageFraming({
                          ...stageFraming,
                          scenario: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="school">School: arrival and wave</option>
                      <option value="playdate">
                        Playdate: meet a new friend
                      </option>
                      <option value="store">
                        Grocery store: checkout line
                      </option>
                      <option value="clinic">Clinic: waiting room</option>
                      <option value="transitions">
                        Transitions: changing activities
                      </option>
                      <option value="routine">
                        Daily routine: getting ready
                      </option>
                      <option value="park">Park: playground interaction</option>
                      <option value="home">Home: family time</option>
                      <option value="restaurant">Restaurant: dining out</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Desired tone
                    </label>
                    <select
                      value={stageFraming.tone}
                      onChange={(e) =>
                        setStageFraming({
                          ...stageFraming,
                          tone: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="brave">Encouraging & brave</option>
                      <option value="encouraging">
                        Encouraging & supportive
                      </option>
                      <option value="calm">Calm & soothing</option>
                      <option value="curious">Curious & playful</option>
                      <option value="confident">Confident & empowering</option>
                      <option value="gentle">Gentle & reassuring</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Parent goal (optional)
                    </label>
                    <input
                      value={stageFraming.parentGoal}
                      onChange={(e) =>
                        setStageFraming({
                          ...stageFraming,
                          parentGoal: e.target.value,
                        })
                      }
                      placeholder="e.g., Practice waving back to a classmate"
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeStage === 2 && (
              <div className="rounded-xl border border-zinc-200 p-4 bg-white space-y-4">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Stage 2 · Immersion
                </h3>
                <p className="text-sm text-zinc-600">
                  Guide imagery and perspective‑taking; co‑play the avatar.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Current feeling
                    </label>
                    <select
                      value={stageImmersion.feeling}
                      onChange={(e) =>
                        setStageImmersion({
                          ...stageImmersion,
                          feeling: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="shy">Shy</option>
                      <option value="excited">Excited</option>
                      <option value="nervous">Nervous</option>
                      <option value="proud">Proud</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Co‑play prompt
                    </label>
                    <select
                      value={stageImmersion.coplay}
                      onChange={(e) =>
                        setStageImmersion({
                          ...stageImmersion,
                          coplay: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="wave">Practice a superhero wave</option>
                      <option value="share">
                        Offer a toy and say "your turn"
                      </option>
                      <option value="count">Count to three together</option>
                      <option value="breathe">Do a 3‑breath sparkle</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-zinc-700">
                      Imagery line (optional)
                    </label>
                    <textarea
                      value={stageImmersion.imagery}
                      onChange={(e) =>
                        setStageImmersion({
                          ...stageImmersion,
                          imagery: e.target.value,
                        })
                      }
                      placeholder="Describe what your child sees (e.g., 'Blue backpack, Mia smiles and waves')."
                      rows={2}
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeStage === 3 && (
              <div className="rounded-xl border border-zinc-200 p-4 bg-white space-y-4">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Stage 3 · Reflection
                </h3>
                <p className="text-sm text-zinc-600">
                  Connect the story to real‑life experiences and log progress.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-700">
                      What did your child try?
                    </label>
                    <input
                      value={stageReflection.tried}
                      onChange={(e) =>
                        setStageReflection({
                          ...stageReflection,
                          tried: e.target.value,
                        })
                      }
                      placeholder="e.g., Waved back and smiled"
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Parent confidence
                    </label>
                    <select
                      value={stageReflection.confidence}
                      onChange={(e) =>
                        setStageReflection({
                          ...stageReflection,
                          confidence: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Child comfort
                    </label>
                    <select
                      value={stageReflection.comfort}
                      onChange={(e) =>
                        setStageReflection({
                          ...stageReflection,
                          comfort: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeStage === 4 && (
              <div className="rounded-xl border border-zinc-200 p-4 bg-white space-y-4">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Stage 4 · Continuity
                </h3>
                <p className="text-sm text-zinc-600">
                  Keep the arc going with micro‑quests and badges.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Next arc
                    </label>
                    <select
                      value={stageContinuity.nextArc}
                      onChange={(e) =>
                        setStageContinuity({
                          ...stageContinuity,
                          nextArc: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="school-arc">
                        School Adventure (week)
                      </option>
                      <option value="friend-arc">New Friend Mini‑Arc</option>
                      <option value="store-arc">Helper at the Store</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">
                      Reminder cadence
                    </label>
                    <select
                      value={stageContinuity.cadence}
                      onChange={(e) =>
                        setStageContinuity({
                          ...stageContinuity,
                          cadence: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option>Daily</option>
                      <option>Every 2 days</option>
                      <option>Weekly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-700">Badge</label>
                    <select
                      value={stageContinuity.badge}
                      onChange={(e) =>
                        setStageContinuity({
                          ...stageContinuity,
                          badge: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                    >
                      <option value="bravery">Bravery Badge</option>
                      <option value="sharing">Sharing Star</option>
                      <option value="helper">Helpful Hero</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={generateStepsFromStages}
              disabled={
                aiGenerating || (aiRetryAt && (aiNow || Date.now()) < aiRetryAt)
              }
              className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3]"
            >
              {aiGenerating
                ? "Generating…"
                : aiRetryAt && (aiNow || Date.now()) < aiRetryAt
                ? `Rate limited (${Math.ceil(
                    (aiRetryAt - (aiNow || Date.now())) / 1000
                  )}s)`
                : "Generate step with Ai"}{" "}
              <Sparkles className="inline-block w-4 h-4 mb-1" />
            </button>
            {aiError ? (
              <span className="text-sm text-red-700">{aiError}</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
