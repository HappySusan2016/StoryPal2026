"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "../hooks/useTranslation";
import Image from "next/image";
import { flushSync } from "react-dom";
import { printStoryPages } from "./printStoryPages";
import { ArrowLeft, ArrowRight, BookOpen, Printer, Sparkles, Star, Volume2 } from "lucide-react";
import { isValidParentGuide } from "../lib/parentGuides";

/** @module Replace storybook profile variables with the current child's details */
export function interpolateStoryText(text, context) {
  if (typeof text !== "string") return text;
  const replaceVariable = (_, path) =>
    String(path.trim().split(".").reduce((value, key) => value?.[key], context) ?? "");
  return text.replace(/@([a-zA-Z0-9_.]+)/g, replaceVariable)
    .replace(/\{\{\s*([^}]+)\s*\}\}/g, replaceVariable);
}

/** @module Cycle through normal, large, and extra-large reading text sizes */
const READER_TEXT_SIZES = [
  { label: "Normal", scale: 1 },
  { label: "Large", scale: 1.25 },
  { label: "Extra large", scale: 1.5 },
];
const READER_TEXT_KEY = "storypal.readerTextSize";

function loadReaderTextSize() {
  if (typeof window === "undefined") return 0;
  try {
    const index = Number(localStorage.getItem(READER_TEXT_KEY));
    return READER_TEXT_SIZES[index] ? index : 0;
  } catch {
    return 0;
  }
}

/**
 * A reusable player that renders a sequence of story steps.
 * Supported step types:
 * - { type: "doctor", message: string } - Message for children
 * - { type: "user-input", message: string, placeholder?: string } - Child's input
 * - { type: "choice", message: string, options: string[] }
 */
export default function StoryPlayer({
  moduleDefinition,
  onClose,
  onFinished,
  templateContext,
  narrate = false,
  preferredVoice = "female",
  childId = null,
  onStarsCollected,
  onPageConfirmed,
  layout = "modal",
  readerHeading,
  childMode = false,
  onReadAgain,
}) {
  const { t } = useTranslation();
  /** @module Layouts for reading, editor preview, and the dialog */
  const isPreview = layout === "preview";
  const isReader = layout === "reader";
  const isModal = layout === "modal";
  const showParentGuide = !isPreview;
  const [readerTextIndex, setReaderTextIndex] = useState(() => isReader ? loadReaderTextSize() : 0);
  const readerTextSize = READER_TEXT_SIZES[readerTextIndex];
  const title = moduleDefinition?.title || "Story";
  const coverImage = moduleDefinition?.coverImage || "";
  const moduleId = moduleDefinition?.id || "";
  const steps = useMemo(
    () => moduleDefinition?.steps || [],
    [moduleDefinition]
  );
  // Normalize fontPreset: treat null, undefined, or "hand" as "classic" for backward compatibility
  // This ensures existing modules that were saved with "hand" (old default) now use "classic" (new default)
  const fontPreset =
    !moduleDefinition?.fontPreset || moduleDefinition?.fontPreset === "hand"
      ? "classic"
      : moduleDefinition.fontPreset;
  const fontStyle = useMemo(() => {
    // Default to Epilogue (classic) if no fontPreset is set
    let result;
    if (!fontPreset || fontPreset === "classic" || fontPreset === "mono") {
      result = { fontFamily: "var(--font-epilogue)" };
    } else if (fontPreset === "playful") {
      result = { fontFamily: "var(--font-slackey)" };
    } else if (fontPreset === "hand") {
      result = { fontFamily: "var(--font-shadows-into-light)" };
    } else {
      result = { fontFamily: "var(--font-epilogue)" };
    }
    return result;
  }, [fontPreset]);

  const [stepIndex, setCurrentStepIndex] = useState(0);
  // After a draft step is deleted, keep the preview on the nearest remaining page.
  const currentStepIndex = isPreview ? Math.min(stepIndex, Math.max(0, steps.length - 1)) : stepIndex;
  const [userInputValue, setUserInputValue] = useState("");
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  /** @module Star collection and navigation after completion */
  const [starsCollected, setStarsCollected] = useState(false);
  const [collectingStars, setCollectingStars] = useState(false);
  const [rewardError, setRewardError] = useState(false);
  const rewardTimerRef = useRef(null);
  const collectingStarsRef = useRef(false);
  const playerMountedRef = useRef(true);
  useEffect(() => {
    playerMountedRef.current = true;
    return () => {
      playerMountedRef.current = false;
      clearTimeout(rewardTimerRef.current);
    };
  }, []);

  // Audio settings state
  const [audioEnabled, setAudioEnabled] = useState(narrate);
  const [voiceType, setVoiceType] = useState(preferredVoice);
  const [speed, setSpeed] = useState("normal"); // "slow", "normal", "fast"
  const [showAudioControls, setShowAudioControls] = useState(false);
  const readerAudioButtonRef = useRef(null);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const needsResponse =
    (currentStep?.type === "user-input" && !userInputValue.trim()) ||
    (currentStep?.type === "choice" && !selectedChoice);

  // --- Speech synthesis (optional narration) ---
  const voicesRef = useRef([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const currentUtteranceRef = useRef(null);

  function loadVoices() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const list = window.speechSynthesis.getVoices();
    if (list && list.length) {
      voicesRef.current = list;
      console.log("Voices loaded:", list.length, "voices available");
    } else {
      console.log("Voices not yet loaded, will retry");
    }
  }

  function pickPreferredVoice() {
    const list = voicesRef.current || [];
    if (!list.length) return null;

    console.log("Available voices:", list.map(v => `${v.name} (${v.lang})`));
    console.log("Looking for:", voiceType, "voice");

    if (voiceType === "male") {
      // Heuristics for male voices - comprehensive patterns
      const maleHeuristics = [
        /\bmale\b/i,
        /\bman\b/i,
        /\bmale\s/i,
        /david|daniel|alex|thomas|james|john|mark|paul|steve|michael|george|matthew|andrew|ryan|christopher|ben|eric|jason|kevin|robert|william/i,
        /man\s/i,
        /\(male\)/i,
      ];

      for (const h of maleHeuristics) {
        const v = list.find((voice) => h.test(voice.name));
        if (v) {
          console.log("Selected male voice:", v.name);
          return v;
        }
      }

      // Fallback: try to find voices that DON'T match female patterns
      const notFemaleVoices = list.filter(voice => {
        const name = voice.name.toLowerCase();
        return !/(female|woman|girl|zira|jenny|aria|samantha|victoria|karen|allison|zoe|michelle|lisa|susan|hazel|emily|sarah|anna|maria)/i.test(name);
      });

      if (notFemaleVoices.length > 0) {
        console.log("Selected male voice (by exclusion):", notFemaleVoices[0].name);
        return notFemaleVoices[0];
      }
    } else {
      // Heuristics for female voices
      const femaleHeuristics = [
        /\bfemale\b/i,
        /\bwoman\b/i,
        /\bfemale\s/i,
        /zira|jenny|aria|samantha|victoria|karen|allison|zoe|michelle|lisa|susan|hazel|emily|sarah|anna|maria|mary|elizabeth|kate|linda|nancy|betty/i,
        /woman\s/i,
        /\(female\)/i,
      ];

      for (const h of femaleHeuristics) {
        const v = list.find((voice) => h.test(voice.name));
        if (v) {
          console.log("Selected female voice:", v.name);
          return v;
        }
      }
    }

    console.log("Using default voice:", list[0].name);
    return list[0];
  }

  function speak(text) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!text || !audioEnabled) return;
    // cancel previous utterance
    window.speechSynthesis.cancel();

    // Use the browser's default voice while its voice list loads.
    if (!voicesRef.current.length) loadVoices();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickPreferredVoice();
    if (voice) {
      utter.voice = voice;
      console.log("Speaking with voice:", voice.name, "| Requested:", voiceType);
    } else {
      console.warn("No voice selected, using system default");
    }

    // Set speed based on user selection
    const speedMap = {
      slow: 0.7,
      normal: 0.95,
      fast: 1.3,
    };
    utter.rate = speedMap[speed] || 0.95;
    utter.pitch = voiceType === "female" ? 1.1 : 1.0;

    setIsSpeaking(true);
    setIsPaused(false);
    currentUtteranceRef.current = utter;

    utter.onstart = () => {
      console.log("Speech started");
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utter.onend = () => {
      console.log("Speech ended");
      setIsSpeaking(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    };

    utter.onerror = (event) => {
      // "interrupted" error is expected when switching voices or stopping speech
      if (event.error === "interrupted") {
        console.log("Speech interrupted (expected when switching voices or stopping)");
      } else {
        console.error("Speech error:", event.error);
      }
      setIsSpeaking(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    };

    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    }
  }

  function pauseSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }

  function resumeSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }

  useEffect(() => {
    // Always load voices when component mounts
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // Force load voices after a short delay (some browsers need this)
      setTimeout(() => {
        loadVoices();
      }, 100);
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!audioEnabled || !currentStep || showCelebration) return;

    // Small delay to ensure voices are loaded before speaking
    const speakTimeout = setTimeout(() => {
      const type = currentStep.type;
      if (type === "doctor") {
        speak(interpolate(currentStep.message || ""));
      } else if (type === "user-input" || type === "choice") {
        speak(interpolate(currentStep.message || ""));
      }
    }, 200);

    return () => clearTimeout(speakTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEnabled, currentStepIndex, voiceType, speed, showCelebration]);

  // Stop speaking when audio is disabled
  useEffect(() => {
    if (!audioEnabled) {
      stopSpeaking();
    }
  }, [audioEnabled]);

  function interpolate(text) {
    return interpolateStoryText(text, templateContext);
  }

  function resetTransientState() {
    setUserInputValue("");
    setSelectedChoice(null);
  }

  function handleClose() {
    resetTransientState();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    onClose?.();
  }

  /** @module Confirm the current reading page and advance the story */
  function handleNext() {
    if (!currentStep || showCelebration || needsResponse) return;

    onPageConfirmed?.(currentStepIndex, isLastStep);
    if (!isLastStep) {
      // Repeated triggers on the same page only advance to the next page.
      setCurrentStepIndex(currentStepIndex + 1);
      resetTransientState();
    } else {
      // Show celebration screen on last step completion
      resetTransientState();
      if (isReader) stopSpeaking();
      setShowCelebration(true);
    }
  }

  /** @module Page navigation and rereading on the standalone reading page */
  function handlePreviousPage() {
    setCurrentStepIndex(currentStepIndex - 1);
    resetTransientState();
  }

  function handlePreviewNextPage() {
    setCurrentStepIndex(currentStepIndex + 1);
    resetTransientState();
  }

  function handleReadAgain() {
    onReadAgain?.();
    setShowAudioControls(false);
    setRewardError(false);
    setCurrentStepIndex(0);
    resetTransientState();
    setShowCelebration(false);
  }

  /** @module Reading tools and child rewards */
  function handleChangeReaderTextSize() {
    const nextIndex = (readerTextIndex + 1) % READER_TEXT_SIZES.length;
    setReaderTextIndex(nextIndex);
    try {
      localStorage.setItem(READER_TEXT_KEY, String(nextIndex));
    } catch {
      // If storage is unavailable, text size can still be adjusted for this reading session.
    }
  }

  async function handleCollectStars() {
    if (collectingStarsRef.current || rewardTimerRef.current !== null) return;
    collectingStarsRef.current = true;
    setCollectingStars(true);
    setRewardError(false);
    try {
      if (onStarsCollected && childId && moduleId) {
        await onStarsCollected(childId, moduleId, 3);
      }
      if (!playerMountedRef.current) return;
      setStarsCollected(true);
      rewardTimerRef.current = setTimeout(() => {
        onFinished?.();
        onClose?.();
      }, 1500);
    } catch (error) {
      console.error("Failed to save stars", error);
      if (playerMountedRef.current) setRewardError(true);
    } finally {
      collectingStarsRef.current = false;
      if (playerMountedRef.current) setCollectingStars(false);
    }
  }

  /** @module Parent guide generation and fallback */
  const [aiGuides, setAiGuides] = useState({});
  const [guideRequest, setGuideRequest] = useState(null);
  // Key the cache on the full content and child context so guides are not reused across stories or children.
  const guideRequestBody = !showParentGuide ? "" : JSON.stringify({
    stepType: currentStep?.type,
    stepMessage: currentStep?.message || "",
    storyTitle: title,
    childContext: templateContext,
  });
  const stepKey = JSON.stringify([moduleId, currentStepIndex, guideRequestBody]);
  const cachedGuide = aiGuides[stepKey];
  const loadingGuide = guideRequest?.key === stepKey && guideRequest.status === "loading";
  const guideError = guideRequest?.key === stepKey ? guideRequest.error : null;

  useEffect(() => {
    if (!showParentGuide || !currentStep || isValidParentGuide(currentStep.parentGuide)) return;
    if (process.env.NEXT_PUBLIC_DISABLE_AI_COACTION === "true") return;
    if (isValidParentGuide(cachedGuide)) return;

    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]);
    let active = true;

    /** Try generating missing or invalid guides before falling back to the default guide. */
    async function generateGuide() {
      setGuideRequest({ key: stepKey, status: "loading", error: null });
      let errorMessage = null;
      try {
        const response = await fetch("/api/generate-coaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: guideRequestBody,
          signal,
        });
        if (!response.ok) throw new Error("AI guidance is unavailable. Default guidance is being used.");
        const data = await response.json();
        if (!isValidParentGuide(data?.guide)) {
          throw new Error("AI returned invalid guidance. Default guidance is being used.");
        }
        if (!active) return;
        // Cache only validated fields from the expected schema and discard extra model output.
        const { title, description, coActionPrompt } = data.guide;
        setAiGuides((prev) => ({ ...prev, [stepKey]: { title, description, coActionPrompt } }));
      } catch {
        if (!active) return;
        errorMessage = signal.aborted
          ? "AI guidance timed out. Default guidance is being used."
          : "AI guidance could not be generated. Default guidance is being used.";
      } finally {
        // Ignore stale requests after switching steps or closing the player.
        if (active) setGuideRequest({ key: stepKey, status: "finished", error: errorMessage });
      }
    }

    generateGuide();
    return () => {
      active = false;
      controller.abort();
    };
  }, [showParentGuide, currentStep, cachedGuide, stepKey, guideRequestBody]);

  // Get parent guide content (AI-generated or fallback)
  const parentGuide = useMemo(() => {
    if (!showParentGuide || !currentStep) return null;

    // Check if step has custom parent guide
    if (isValidParentGuide(currentStep.parentGuide)) {
      return currentStep.parentGuide;
    }

    // Check for AI-generated guide
    if (isValidParentGuide(cachedGuide)) {
      return cachedGuide;
    }

    // Show loading state
    if (loadingGuide) {
      return {
        title: "Generating...",
        description: "Creating personalized co-action guidance...",
        coActionPrompt: "",
      };
    }

    // Fallback to default guides if AI fails
    if (currentStep.type === "doctor") {
      return {
        title: "Guide Moment",
        description:
          "Read this message together with your child at their pace.",
        coActionPrompt:
          "Practice: Pause after reading and ask, 'How does that feel?'",
      };
    }
    if (currentStep.type === "user-input") {
      return {
        title: "Co-Action Prompt",
        description: "Work together to share thoughts and feelings.",
        coActionPrompt:
          "Practice: 'Let's think about this together. What would you like to say?'",
      };
    }
    if (currentStep.type === "choice") {
      return {
        title: "Choice Support",
        description: "Give your child time to think and choose.",
        coActionPrompt:
          "Practice: 'There's no wrong answer. Which one feels right to you?'",
      };
    }
    return null;
  }, [showParentGuide, currentStep, cachedGuide, loadingGuide]);

  /** @module Storybook content display */
  function renderStoryContent(step, isPrintPage = false) {
    return (
      <>
          {coverImage && !isModal && !isPrintPage ? (
            <div className="story-preview-image">
              <Image src={coverImage} alt={title} width={1500} height={1000} unoptimized />
            </div>
          ) : coverImage ? (
            <div className="story-print-cover relative w-full aspect-4/3 overflow-hidden">
              <Image
                src={coverImage}
                alt={title}
                fill
                className="object-cover"
                unoptimized
                sizes="90vw"
              />
            </div>
          ) : !isModal && !isPrintPage ? (
            <div className="story-preview-cover grid place-items-center" aria-hidden="true">
              <BookOpen size={48} strokeWidth={1.5} />
            </div>
          ) : moduleId === "parent-training" ? (
            <div className="story-print-cover relative w-full aspect-4/3 overflow-hidden bg-gradient-to-br from-purple-100 via-pink-50 to-blue-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-purple-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-24 h-24"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="text-lg font-semibold">{t("Parent Training")}</span>
              </div>
            </div>
          ) : null}
          <div className="story-print-copy p-6 flex-1 flex flex-col" style={fontStyle}>
            {(!isReader || isPrintPage) && (
              <h3 className="text-2xl font-semibold text-zinc-900 mb-4" style={fontStyle}>
                {interpolate(title)}
              </h3>
            )}

            {step && (
              <div className="story-print-step flex-1 space-y-4">
                {step.imageUrl && (
                  <div className="story-print-step-image w-full rounded-2xl overflow-hidden border border-zinc-200">
                    <img
                      src={step.imageUrl}
                      alt={interpolate(step.message || title)}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                {step.type === "doctor" && (
                  <div className="bg-[#f5f0ff] rounded-2xl p-4 border border-[#e5eee4]">
                    <p
                      className="text-zinc-900 text-lg leading-relaxed"
                      style={fontStyle}
                    >
                      {interpolate(step.message || "")}
                    </p>
                  </div>
                )}

                {step.type === "user-input" && (
                  <div className="space-y-3">
                    <div className="bg-[#f5f0ff] rounded-2xl p-4 border border-[#e5eee4]">
                      <p
                        className="text-zinc-900 text-lg mb-2"
                        style={fontStyle}
                      >
                        {interpolate(step.message || "")}
                      </p>
                    </div>
                    <input
                      type="text"
                      aria-label={t("Child's input")}
                      value={isPrintPage && step !== currentStep ? "" : userInputValue}
                      onChange={(e) => setUserInputValue(e.target.value)}
                      placeholder={interpolate(
                        step.placeholder || "Enter your answer here..."
                      )}
                      className="w-full bg-white/90 border-2 border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all"
                      style={fontStyle}
                      onKeyDown={(e) => {
                        if (!isPreview && e.key === "Enter" && userInputValue.trim()) {
                          handleNext();
                        }
                      }}
                      autoFocus={isModal && !isPrintPage}
                    />
                  </div>
                )}

                {step.type === "choice" &&
                  Array.isArray(step.options) && (
                    <div className="space-y-3">
                      <div className="bg-[#f5f0ff] rounded-2xl p-4 border border-[#e5eee4]">
                        <p
                          className="text-zinc-900 text-lg mb-2"
                          style={fontStyle}
                        >
                          {interpolate(step.message || "")}
                        </p>
                      </div>
                      <div className="story-print-options grid grid-cols-2 gap-3">
                        {step.options.map((option, idx) => {
                          const label = interpolate(option);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedChoice(label)}
                              className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                                (!isPrintPage || step === currentStep) && selectedChoice === label
                                  ? "bg-[#315e4a] text-white shadow-md"
                                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                              }`}
                              style={fontStyle}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

              </div>
            )}
          </div>
      </>
    );
  }

  /** @module Storybook printing */
  const printPagesRef = useRef(null);
  const printingRef = useRef(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState("");

  // Render all pages separately to avoid reading side effects such as page turns, narration, and rewards.
  async function handlePrint() {
    if (printingRef.current || !steps.length) return;
    printingRef.current = true;
    setPrintError("");
    try {
      flushSync(() => setIsPrinting(true));
      await printStoryPages(
        printPagesRef.current,
        interpolate(title),
      );
    } catch (error) {
      console.error("Story printing failed:", error);
      setPrintError("Unable to prepare printing. Please try again.");
    } finally {
      printingRef.current = false;
      setIsPrinting(false);
    }
  }

  // Handle empty storybooks after calling all hooks to keep hook order stable.
  if (!Array.isArray(steps) || (isModal && steps.length === 0)) return null;

  /** @module Storybook content, parent guidance, and completion state */
  const playerClassName = isReader
    ? "story-reader-layout story-player-content"
    : `relative w-full rounded-2xl bg-white shadow-lg flex flex-col lg:flex-row overflow-hidden story-player-content ${isPreview ? "story-preview-stage" : "z-10 max-w-6xl max-h-[90vh] min-h-[600px] animate-[fadeInUp_200ms_ease-out]"}`;

  const printPages = isPrinting && (
    <div aria-hidden="true" style={{ position: "fixed", left: "-100000px", top: 0, width: 640, pointerEvents: "none" }}>
      <div ref={printPagesRef}>
        {steps.map((step, index) => (
          <section className="story-print-page" key={index}>
            <div className="story-print-content bg-white">{renderStoryContent(step, true)}</div>
          </section>
        ))}
      </div>
    </div>
  );

  /** @module Shared audio panel for the reading page, editor preview, and legacy player */
  function handleCloseAudioControls() {
    setShowAudioControls(false);
    if (isReader) readerAudioButtonRef.current?.focus();
  }

  const audioControls = showAudioControls && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{t("Audio Settings")}</h3>
        <button
          type="button"
          onClick={handleCloseAudioControls}
          aria-label={t("Close")}
          className="text-zinc-400 hover:text-zinc-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Enable/Disable Audio */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-700">{t("Enable Audio")}</label>
        <button
          type="button"
          role="switch"
          aria-label={t("Enable Audio")}
          aria-checked={audioEnabled}
          onClick={() => {
            setAudioEnabled(!audioEnabled);
            if (audioEnabled) stopSpeaking();
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            audioEnabled ? "bg-blue-600" : "bg-zinc-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              audioEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* The read-aloud effect replays the current page with the updated voice or speed. */}
      <div role="group" aria-label={t("Voice")}>
        <p className="mb-2 text-sm text-zinc-700">{t("Voice")}</p>
        <div className="flex flex-wrap gap-2">
          {[["female", "Female"], ["male", "Male"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={voiceType === value}
              onClick={() => setVoiceType(value)}
              className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-blue-600 aria-pressed:text-white"
            >{t(label)}</button>
          ))}
        </div>
      </div>

      <div role="group" aria-label={t("Speed")}>
        <p className="mb-2 text-sm text-zinc-700">{t("Speed")}</p>
        <div className="flex flex-wrap gap-2">
          {[["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
              className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-blue-600 aria-pressed:text-white"
            >{t(label)}</button>
          ))}
        </div>
      </div>

      {/* Playback Controls */}
      {audioEnabled && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={() => {
              if (isPaused) {
                // If paused, resume
                resumeSpeaking();
              } else if (isSpeaking) {
                // If speaking, pause
                pauseSpeaking();
              } else {
                // If not speaking, start speaking
                if (currentStep) {
                  const type = currentStep.type;
                  if (
                    type === "doctor" ||
                    type === "user-input" ||
                    type === "choice"
                  ) {
                    speak(interpolate(currentStep.message || ""));
                  }
                }
              }
            }}
            className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            {isPaused ? t("Resume") : (isSpeaking ? t("Pause") : t("Play"))}
          </button>
          <button
            type="button"
            onClick={stopSpeaking}
            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >{t("Stop")}</button>
        </div>
      )}
    </div>
  );

  const readerHeader = isReader && (
    <header
      className="story-reader-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && showAudioControls) handleCloseAudioControls();
      }}
    >
      {readerHeading}
      <div className="story-reader-tools">
        <button type="button" className="tool-btn" ref={readerAudioButtonRef}
          aria-expanded={showAudioControls && !showCelebration}
          aria-controls={showAudioControls && !showCelebration ? "reader-audio-controls" : undefined}
          onClick={() => setShowAudioControls((open) => !open)}
          disabled={!currentStep || showCelebration || (typeof window !== "undefined" && !window.speechSynthesis)}>
          <Volume2 className="size-[13px]" aria-hidden="true" />{t("Read aloud")}
        </button>
        <button type="button" className="tool-btn" onClick={handleChangeReaderTextSize}
          aria-label={`${t("Text size")}: ${t(readerTextSize.label)}`}>
          <span aria-hidden="true">Aa</span>{t("Text size")}
        </button>
        <button type="button" className="tool-btn" onClick={handlePrint} disabled={isPrinting || !steps.length}>
          <Printer className="size-[13px]" aria-hidden="true" />{t("Print")}
        </button>
      </div>
      {!showCelebration && audioControls && (
        <section id="reader-audio-controls" aria-label={t("Audio Settings")} className="story-reader-audio-panel">
          {audioControls}
        </section>
      )}
    </header>
  );

  if (isReader && showCelebration) {
    return (
      <>
        {readerHeader}
        {printPages}
        {printError && <p role="alert" className="p-4 text-red-700">{t(printError)}</p>}
        <section className="story-preview-stage story-reader-completion" aria-labelledby="story-complete-heading">
          {childMode && (
            <div className={`story-reward-stars${starsCollected ? " is-collected" : ""}`} aria-hidden="true">
              {[0, 1, 2].map((index) => <Star key={index} style={{ "--star-order": index }} />)}
            </div>
          )}
          <h2 id="story-complete-heading" className="text-2xl font-semibold" tabIndex={-1} ref={(heading) => { heading?.focus(); }}>
            {t("Congratulations!")}
          </h2>
          {rewardError && <p role="alert" className="mt-3 text-red-700">{t("Could not save changes. Please try again.")}</p>}
          {childMode && (starsCollected ? (
            <p role="status" className="mt-4 text-lg font-semibold text-[#315e4a]">{t("3 Stars Collected!")}</p>
          ) : (
            <button type="button" className="story-editor-button is-primary mt-4" onClick={handleCollectStars}
              disabled={collectingStars} aria-busy={collectingStars}>
              {collectingStars ? t("Loading…") : `${t("Collect Your")} ${t("3 Stars")}`}
            </button>
          ))}
          {(!childMode || (!starsCollected && !collectingStars)) && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" className="story-editor-button" onClick={handleReadAgain}>{t("Read again")}</button>
              <button type="button" className="story-editor-button" onClick={onFinished}>{t("All done")}</button>
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <div className={isModal ? "fixed inset-0 z-50 flex items-center justify-center p-4" : undefined}>
      {isModal && (
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />
      )}
      {readerHeader}
      {printPages}
      <div className={playerClassName} style={isReader ? { "--reader-scale": readerTextSize.scale } : undefined}>
        <div className={`relative flex min-w-0 flex-1 flex-col ${isReader ? "story-preview-stage overflow-hidden" : "overflow-y-auto"}`}>
          {/* Keep the print control in its original position in the dialog and editor preview. */}
          {!isReader && (
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || !steps.length}
              className="story-player-print hidden lg:flex absolute top-4 right-28 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow-md items-center justify-center text-zinc-700 disabled:opacity-50"
              aria-label={t("Print")}
              title={t("Print")}
            >
              <Printer className="w-5 h-5" />
            </button>
          )}
          {printError && <p role="alert" className="p-4 text-red-700">{printError}</p>}
          {/* Close button for the desktop reading dialog */}
          {isModal && (
            <button
              type="button"
              onClick={handleClose}
              className="hidden lg:flex absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-md items-center justify-center text-zinc-700 hover:text-zinc-900 transition-all"
              aria-label={t("Close")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* Keep separate audio settings for the editor preview and legacy player. */}
          {!isReader && (
            <button
              type="button"
              onClick={() => setShowAudioControls(!showAudioControls)}
              className="hidden lg:flex absolute top-4 right-16 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-md items-center justify-center text-zinc-700 hover:text-zinc-900 transition-all"
              aria-label={t("Audio Settings")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4.617-3.793a1 1 0 01.383-.131zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {!isReader && audioControls && (
            <div className="hidden lg:block absolute top-16 right-4 z-20 w-64 bg-white rounded-xl shadow-lg border border-zinc-200 p-4">
              {audioControls}
            </div>
          )}

          {renderStoryContent(currentStep)}
          {!isModal && (
            currentStep ? (
              <nav aria-label={t(isPreview ? "Preview" : "Read")} className="story-preview-pagination mx-6 mb-4 border-t border-[#e3e9df] pt-4">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={currentStepIndex === 0}
                  className="story-preview-prev story-editor-button is-primary"
                >
                  <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                  {t("Previous page")}
                </button>
                <span aria-live="polite" className="sr-only">
                  {t("Page {current} of {total}", { current: currentStepIndex + 1, total: steps.length })}
                </span>
                <div className="story-preview-dots" aria-hidden="true">
                  {steps.map((step, index) => (
                    <span key={step.id || index} className={index === currentStepIndex ? "is-current" : undefined} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={isPreview ? handlePreviewNextPage : handleNext}
                  disabled={isPreview ? isLastStep : needsResponse}
                  className="story-preview-next story-editor-button is-primary"
                >
                  {t(isReader && isLastStep ? "Finish" : "Next page")}
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </button>
              </nav>
            ) : (
              <p className="mx-6 mb-4 text-sm text-zinc-600">{t(isPreview ? "Add a step to preview your story." : "This story has no pages yet.")}</p>
            )
          )}

          {!isReader && (
            <div className="px-6 pb-6">
              {currentStep && (
                <div>
                  <div className="flex justify-between items-center pt-4 border-t border-zinc-200 lg:hidden">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={handlePrint} disabled={isPrinting || !steps.length} aria-label={t("Print")} className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
                        <Printer className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAudioControls(!showAudioControls)}
                        className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"
                        aria-label={t("Audio Settings")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-5 h-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4.617-3.793a1 1 0 01.383-.131zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      {isModal && (
                        <button
                          type="button"
                          onClick={handleClose}
                          className="rounded-xl px-4 py-2 text-zinc-700 hover:bg-zinc-100"
                        >{t("Close")}</button>
                      )}
                    </div>
                    {isModal && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (currentStepIndex > 0) {
                              setCurrentStepIndex((idx) => idx - 1);
                              resetTransientState();
                            }
                          }}
                          disabled={currentStepIndex === 0}
                          className="rounded-xl px-4 py-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >{t("Back")}</button>
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={
                            (currentStep.type === "user-input" &&
                              !userInputValue.trim()) ||
                            (currentStep.type === "choice" && !selectedChoice)
                          }
                          className="rounded-xl px-6 py-2 bg-[#315e4a] text-white hover:bg-[#244a39] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {isLastStep ? t("Finish") : t("Next")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {audioControls && (
                <div className="lg:hidden mt-4 bg-white rounded-xl shadow-lg border border-zinc-200 p-4">
                  {audioControls}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Parent Guide Panel */}
        {parentGuide && (
          <aside
            aria-label={t("Parent Guide")}
            aria-live={isReader ? "polite" : undefined}
            className={isReader ? "story-reader-guide" : "lg:w-96 bg-[#fef9f0] border-l border-[#f5e6d3] p-6 flex flex-col overflow-y-auto"}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-amber-800 text-xs font-semibold tracking-wide uppercase flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>{t("Parent Guide")}</span>
              {!isValidParentGuide(currentStep?.parentGuide) && isValidParentGuide(cachedGuide) && !loadingGuide && (
                <span className="text-purple-600 flex items-center gap-1" title={t("AI-generated guidance")}>
                  <Sparkles className="w-3 h-3" />
                </span>
              )}
            </div>

            <h3 className="text-xl font-semibold text-amber-900 mb-2 flex items-center gap-2">
              {parentGuide.title}
              {loadingGuide && (
                <span className="animate-spin">
                  <svg className="w-4 h-4 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              )}
            </h3>
            <p className="text-amber-800 text-sm mb-6">
              {parentGuide.description}
            </p>

            {loadingGuide ? (
              <div className="bg-white/50 rounded-xl p-4 border border-amber-200 flex items-center justify-center gap-2">
                <div className="animate-pulse text-amber-600">{t("Generating personalized guidance...")}</div>
              </div>
            ) : parentGuide.coActionPrompt ? (
              <div className="bg-white/50 rounded-xl p-4 border border-amber-200">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />{t("Co-Action Prompt")}</div>
                <p className="text-amber-900 text-sm italic leading-relaxed">
                  {parentGuide.coActionPrompt}
                </p>
              </div>
            ) : guideError ? (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">{t("Error")}</div>
                <p className="text-red-700 text-sm">
                  {t(guideError)}
                </p>
              </div>
            ) : null}

            {isModal && (
              <div className="mt-auto pt-6 flex items-center justify-between border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStepIndex > 0) {
                      setCurrentStepIndex((idx) => idx - 1);
                      resetTransientState();
                    }
                  }}
                  disabled={currentStepIndex === 0}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-amber-800 hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label={t("Previous step")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <span className="text-sm text-amber-800 font-medium">
                  {currentStepIndex + 1} / {steps.length}
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    (currentStep?.type === "user-input" &&
                      !userInputValue.trim()) ||
                    (currentStep?.type === "choice" && !selectedChoice)
                  }
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                  aria-label={isLastStep ? t("Finish") : t("Next step")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}
          </aside>
        )}

        {/* Celebration Overlay */}
        {isModal && showCelebration && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600/95 via-pink-500/95 to-yellow-400/95 backdrop-blur-sm animate-[fadeIn_300ms_ease-out] overflow-hidden">
            {/* Confetti Background */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-2xl animate-[confettiFall_3s_ease-out_infinite]"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `-${Math.random() * 20}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    opacity: 0.7 + Math.random() * 0.3,
                  }}
                >
                  {
                    ["🎉", "🎊", "⭐", "✨", "🌟"][
                      Math.floor(Math.random() * 5)
                    ]
                  }
                </div>
              ))}
            </div>

            <div className="text-center px-6 py-8 max-w-lg relative z-10">
              {/* Bouncing Trophy */}
              <div className="mb-8 animate-[bounce_1s_ease-in-out_infinite]">
                <div className="text-9xl">🏆</div>
              </div>

              {/* Congratulations Text */}
              <h2 className="text-5xl font-bold text-white mb-4 animate-[fadeInUp_400ms_ease-out] drop-shadow-lg">{t("Congratulations!")}</h2>
              <p className="text-2xl text-white/90 mb-8 animate-[fadeInUp_500ms_ease-out] drop-shadow-md">{t("You completed")}<span className="font-bold">{title}</span>!
              </p>

              {/* Collect Stars Button */}
              {!starsCollected ? (
                <button
                  type="button"
                  onClick={handleCollectStars}
                  className="group relative px-8 py-4 bg-white rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 animate-[fadeInUp_600ms_ease-out]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl group-hover:animate-bounce">
                      ⭐
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-purple-600 uppercase tracking-wide">{t("Collect Your")}</div>
                      <div className="text-2xl font-bold text-purple-700">{t("3 Stars")}</div>
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-200/50 to-purple-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10"></div>
                </button>
              ) : (
                <div className="animate-[fadeInUp_200ms_ease-out]">
                  <div className="text-6xl mb-4">⭐</div>
                  <p className="text-2xl font-bold text-white drop-shadow-lg">{t("3 Stars Collected!")}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
