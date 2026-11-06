"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";

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
}) {
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

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userInputValue, setUserInputValue] = useState("");
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [starsCollected, setStarsCollected] = useState(false);

  // Audio settings state
  const [audioEnabled, setAudioEnabled] = useState(narrate);
  const [voiceType, setVoiceType] = useState(preferredVoice);
  const [speed, setSpeed] = useState("normal"); // "slow", "normal", "fast"
  const [showAudioControls, setShowAudioControls] = useState(false);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

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
    
    // Ensure voices are loaded
    if (!voicesRef.current || voicesRef.current.length === 0) {
      loadVoices();
      // If still no voices after loading, wait a bit and retry once
      if (!voicesRef.current || voicesRef.current.length === 0) {
        console.warn("Voices not loaded yet, retrying in 100ms");
        setTimeout(() => {
          loadVoices();
          if (audioEnabled) {
            speak(text);
          }
        }, 100);
        return;
      }
    }
    
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
    if (!audioEnabled || !currentStep) return;
    
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
  }, [audioEnabled, currentStepIndex, voiceType, speed]);

  // Stop speaking when audio is disabled
  useEffect(() => {
    if (!audioEnabled) {
      stopSpeaking();
    }
  }, [audioEnabled]);

  function getByPath(obj, path) {
    if (!obj || !path) return "";
    return (
      path.split(".").reduce((acc, key) => {
        if (acc == null) return "";
        return acc[key];
      }, obj) ?? ""
    );
  }

  function interpolate(text) {
    if (typeof text !== "string") return text;
    // First handle @ syntax (e.g., @child.name)
    let result = text.replace(/@([a-zA-Z0-9_.]+)/g, (_, expr) => {
      const value = getByPath(templateContext, expr.trim());
      return value == null ? "" : String(value);
    });
    // Then handle {{}} syntax for backward compatibility (e.g., {{child.name}})
    result = result.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => {
      const value = getByPath(templateContext, expr.trim());
      return value == null ? "" : String(value);
    });
    return result;
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

  function handleNext() {
    if (currentStep?.type === "user-input" && !userInputValue.trim()) return;
    if (currentStep?.type === "choice" && !selectedChoice) return;

    if (!isLastStep) {
      setCurrentStepIndex((idx) => idx + 1);
      resetTransientState();
    } else {
      // Show celebration screen on last step completion
      resetTransientState();
      setShowCelebration(true);
    }
  }

  function handleCollectStars() {
    const stars = 3; // Award 3 stars per completed module
    setStarsCollected(true);

    // Call the parent callback to save stars
    if (onStarsCollected && childId && moduleId) {
      onStarsCollected(childId, moduleId, stars);
    }

    // Close after a short delay
    setTimeout(() => {
      onFinished?.();
      onClose?.();
    }, 1500);
  }

  if (!Array.isArray(steps) || steps.length === 0) return null;

  // State for AI-generated co-action prompts
  const [aiGuides, setAiGuides] = useState({});
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState(null);

  // Generate AI co-action prompt for current step
  useEffect(() => {
    if (!currentStep) return;

    // Check if step has custom parent guide
    if (currentStep.parentGuide) return;

    // Check if AI co-action is disabled via environment variable
    if (process.env.NEXT_PUBLIC_DISABLE_AI_COACTION === "true") {
      return; // Skip AI generation, use fallback prompts
    }

    // Check if we already have an AI guide for this step
    const stepKey = `${currentStepIndex}_${currentStep.type}_${currentStep.message?.substring(0, 50)}`;
    if (aiGuides[stepKey]) return;

    // Generate AI guide
    const generateGuide = async () => {
      setLoadingGuide(true);
      setGuideError(null);

      try {
        const response = await fetch("/api/generate-coaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepType: currentStep.type,
            stepMessage: currentStep.message || "",
            storyTitle: title,
            childContext: templateContext,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          
          // If quota is exhausted, silently fall back to default prompts
          if (errorData.quotaExhausted || errorData.error === "Quota exhausted") {
            console.warn("AI co-action quota exhausted, using default prompts");
            return; // Don't throw error, just use fallback
          }
          
          throw new Error(errorData.message || "Failed to generate guide");
        }

        const data = await response.json();
        if (data.guide) {
          setAiGuides((prev) => ({
            ...prev,
            [stepKey]: data.guide,
          }));
        }
      } catch (error) {
        console.error("Error generating co-action guide:", error);
        // Only show error for non-quota issues
        if (!error.message?.includes("quota") && !error.message?.includes("Quota")) {
          setGuideError(error.message);
        }
      } finally {
        setLoadingGuide(false);
      }
    };

    generateGuide();
  }, [currentStep, currentStepIndex, aiGuides, title, templateContext]);

  // Get parent guide content (AI-generated or fallback)
  const parentGuide = useMemo(() => {
    if (!currentStep) return null;

    // Check if step has custom parent guide
    if (currentStep.parentGuide) {
      return currentStep.parentGuide;
    }

    // Check for AI-generated guide
    const stepKey = `${currentStepIndex}_${currentStep.type}_${currentStep.message?.substring(0, 50)}`;
    if (aiGuides[stepKey]) {
      return aiGuides[stepKey];
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
  }, [currentStep, currentStepIndex, aiGuides, loadingGuide]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] min-h-[600px] rounded-2xl bg-white shadow-lg animate-[fadeInUp_200ms_ease-out] flex flex-col lg:flex-row overflow-hidden story-player-content">
        {/* Main Story Content */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          {/* Close button for desktop */}
          <button
            type="button"
            onClick={handleClose}
            className="hidden lg:flex absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-md items-center justify-center text-zinc-700 hover:text-zinc-900 transition-all"
            aria-label="Close"
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

          {/* Audio Controls Button */}
          <button
            type="button"
            onClick={() => setShowAudioControls(!showAudioControls)}
            className="hidden lg:flex absolute top-4 right-16 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-md items-center justify-center text-zinc-700 hover:text-zinc-900 transition-all"
            aria-label="Audio Settings"
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

          {/* Audio Controls Panel */}
          {showAudioControls && (
            <div className="hidden lg:block absolute top-16 right-4 z-20 w-64 bg-white rounded-xl shadow-lg border border-zinc-200 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Audio Settings
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAudioControls(false)}
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
                  <label className="text-sm text-zinc-700">Enable Audio</label>
                  <button
                    type="button"
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

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm text-zinc-700 mb-2">
                    Voice
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceType("female");
                        stopSpeaking();
                        if (audioEnabled && currentStep) {
                          const type = currentStep.type;
                          if (
                            type === "doctor" ||
                            type === "user-input" ||
                            type === "choice"
                          ) {
                            speak(interpolate(currentStep.message || ""));
                          }
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        voiceType === "female"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Female
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceType("male");
                        stopSpeaking();
                        if (audioEnabled && currentStep) {
                          const type = currentStep.type;
                          if (
                            type === "doctor" ||
                            type === "user-input" ||
                            type === "choice"
                          ) {
                            speak(interpolate(currentStep.message || ""));
                          }
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        voiceType === "male"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Male
                    </button>
                  </div>
                </div>

                {/* Speed Selection */}
                <div>
                  <label className="block text-sm text-zinc-700 mb-2">
                    Speed
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSpeed("slow");
                        stopSpeaking();
                        if (audioEnabled && currentStep) {
                          const type = currentStep.type;
                          if (
                            type === "doctor" ||
                            type === "user-input" ||
                            type === "choice"
                          ) {
                            speak(interpolate(currentStep.message || ""));
                          }
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        speed === "slow"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Slow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeed("normal");
                        stopSpeaking();
                        if (audioEnabled && currentStep) {
                          const type = currentStep.type;
                          if (
                            type === "doctor" ||
                            type === "user-input" ||
                            type === "choice"
                          ) {
                            speak(interpolate(currentStep.message || ""));
                          }
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        speed === "normal"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeed("fast");
                        stopSpeaking();
                        if (audioEnabled && currentStep) {
                          const type = currentStep.type;
                          if (
                            type === "doctor" ||
                            type === "user-input" ||
                            type === "choice"
                          ) {
                            speak(interpolate(currentStep.message || ""));
                          }
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        speed === "fast"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Fast
                    </button>
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
                      {isPaused ? "Resume" : (isSpeaking ? "Pause" : "Play")}
                    </button>
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Stop
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {coverImage ? (
            <div className="relative w-full aspect-4/3 overflow-hidden">
              <Image
                src={coverImage}
                alt={title}
                fill
                className="object-cover"
                unoptimized
                sizes="90vw"
              />
            </div>
          ) : moduleId === "parent-training" ? (
            <div className="relative w-full aspect-4/3 overflow-hidden bg-gradient-to-br from-purple-100 via-pink-50 to-blue-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-purple-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-24 h-24"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="text-lg font-semibold">Parent Training</span>
              </div>
            </div>
          ) : null}
          <div className="p-6 flex-1 flex flex-col" style={fontStyle}>
            <h3
              className="text-2xl font-semibold text-zinc-900 mb-4"
              style={fontStyle}
            >
              {interpolate(title)}
            </h3>

            {currentStep && (
              <div className="flex-1 space-y-4">
                {currentStep.imageUrl && (
                  <div className="w-full rounded-2xl overflow-hidden border border-zinc-200">
                    <img
                      src={currentStep.imageUrl}
                      alt={interpolate(currentStep.message || title)}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                {currentStep.type === "doctor" && (
                  <div className="bg-[#f5f0ff] rounded-2xl p-4 border border-[#e4d7ff]">
                    <p
                      className="text-zinc-900 text-lg leading-relaxed"
                      style={fontStyle}
                    >
                      {interpolate(currentStep.message || "")}
                    </p>
                  </div>
                )}

                {currentStep.type === "user-input" && (
                  <div className="space-y-3">
                    <div className="bg-[#f5f0ff] rounded-2xl p-4 border border-[#e4d7ff]">
                      <p
                        className="text-zinc-900 text-lg mb-2"
                        style={fontStyle}
                      >
                        {interpolate(currentStep.message || "")}
                      </p>
                    </div>
                    <input
                      type="text"
                      value={userInputValue}
                      onChange={(e) => setUserInputValue(e.target.value)}
                      placeholder={interpolate(
                        currentStep.placeholder || "Enter your answer here..."
                      )}
                      className="w-full bg-white/90 border-2 border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all"
                      style={fontStyle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && userInputValue.trim()) {
                          handleNext();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                )}

                {currentStep.type === "choice" &&
                  Array.isArray(currentStep.options) && (
                    <div className="space-y-3">
                      <div className="bg-[#f5f0ff] rounded-2xl p-4 border border-[#e4d7ff]">
                        <p
                          className="text-zinc-900 text-lg mb-2"
                          style={fontStyle}
                        >
                          {interpolate(currentStep.message || "")}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {currentStep.options.map((option, idx) => {
                          const label = interpolate(option);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedChoice(label)}
                              className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                                selectedChoice === label
                                  ? "bg-[#5b217f] text-white shadow-md"
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

                <div className="flex justify-between items-center pt-4 border-t border-zinc-200 lg:hidden">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAudioControls(!showAudioControls)}
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"
                      aria-label="Audio Settings"
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
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-xl px-4 py-2 text-zinc-700 hover:bg-zinc-100"
                    >
                      Close
                    </button>
                  </div>
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
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={
                        (currentStep.type === "user-input" &&
                          !userInputValue.trim()) ||
                        (currentStep.type === "choice" && !selectedChoice)
                      }
                      className="rounded-xl px-6 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isLastStep ? "Finish" : "Next"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Audio Controls Panel */}
            {showAudioControls && (
              <div className="lg:hidden mt-4 bg-white rounded-xl shadow-lg border border-zinc-200 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Audio Settings
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAudioControls(false)}
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
                    <label className="text-sm text-zinc-700">
                      Enable Audio
                    </label>
                    <button
                      type="button"
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

                  {/* Voice Selection */}
                  <div>
                    <label className="block text-sm text-zinc-700 mb-2">
                      Voice
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVoiceType("female");
                          stopSpeaking();
                          if (audioEnabled && currentStep) {
                            const type = currentStep.type;
                            if (
                              type === "doctor" ||
                              type === "user-input" ||
                              type === "choice"
                            ) {
                              speak(interpolate(currentStep.message || ""));
                            }
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          voiceType === "female"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Female
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVoiceType("male");
                          stopSpeaking();
                          if (audioEnabled && currentStep) {
                            const type = currentStep.type;
                            if (
                              type === "doctor" ||
                              type === "user-input" ||
                              type === "choice"
                            ) {
                              speak(interpolate(currentStep.message || ""));
                            }
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          voiceType === "male"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Male
                      </button>
                    </div>
                  </div>

                  {/* Speed Selection */}
                  <div>
                    <label className="block text-sm text-zinc-700 mb-2">
                      Speed
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSpeed("slow");
                          stopSpeaking();
                          if (audioEnabled && currentStep) {
                            const type = currentStep.type;
                            if (
                              type === "doctor" ||
                              type === "user-input" ||
                              type === "choice"
                            ) {
                              speak(interpolate(currentStep.message || ""));
                            }
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          speed === "slow"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Slow
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSpeed("normal");
                          stopSpeaking();
                          if (audioEnabled && currentStep) {
                            const type = currentStep.type;
                            if (
                              type === "doctor" ||
                              type === "user-input" ||
                              type === "choice"
                            ) {
                              speak(interpolate(currentStep.message || ""));
                            }
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          speed === "normal"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSpeed("fast");
                          stopSpeaking();
                          if (audioEnabled && currentStep) {
                            const type = currentStep.type;
                            if (
                              type === "doctor" ||
                              type === "user-input" ||
                              type === "choice"
                            ) {
                              speak(interpolate(currentStep.message || ""));
                            }
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          speed === "fast"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Fast
                      </button>
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
                        {isPaused ? "Resume" : (isSpeaking ? "Pause" : "Play")}
                      </button>
                      <button
                        type="button"
                        onClick={stopSpeaking}
                        className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parent Guide Panel */}
        {parentGuide && (
          <div className="lg:w-96 bg-[#fef9f0] border-l border-[#f5e6d3] p-6 flex flex-col overflow-y-auto">
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
                </svg>
                Parent Guide
              </span>
              {!currentStep?.parentGuide && !loadingGuide && parentGuide.coActionPrompt && (
                <span className="text-purple-600 flex items-center gap-1" title="AI-generated guidance">
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
                <div className="animate-pulse text-amber-600">Generating personalized guidance...</div>
              </div>
            ) : parentGuide.coActionPrompt ? (
              <div className="bg-white/50 rounded-xl p-4 border border-amber-200">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Co-Action Prompt
                </div>
                <p className="text-amber-900 text-sm italic leading-relaxed">
                  {parentGuide.coActionPrompt}
                </p>
              </div>
            ) : guideError ? (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                  Error
                </div>
                <p className="text-red-700 text-sm">
                  {guideError}
                </p>
              </div>
            ) : null}

            {/* Step Progress */}
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
                aria-label="Previous step"
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
                aria-label={isLastStep ? "Finish" : "Next step"}
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
          </div>
        )}

        {/* Celebration Overlay */}
        {showCelebration && (
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
              <h2 className="text-5xl font-bold text-white mb-4 animate-[fadeInUp_400ms_ease-out] drop-shadow-lg">
                Congratulations!
              </h2>
              <p className="text-2xl text-white/90 mb-8 animate-[fadeInUp_500ms_ease-out] drop-shadow-md">
                You completed <span className="font-bold">{title}</span>!
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
                      <div className="text-sm font-semibold text-purple-600 uppercase tracking-wide">
                        Collect Your
                      </div>
                      <div className="text-2xl font-bold text-purple-700">
                        3 Stars
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-200/50 to-purple-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10"></div>
                </button>
              ) : (
                <div className="animate-[fadeInUp_200ms_ease-out]">
                  <div className="text-6xl mb-4">⭐</div>
                  <p className="text-2xl font-bold text-white drop-shadow-lg">
                    3 Stars Collected!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
