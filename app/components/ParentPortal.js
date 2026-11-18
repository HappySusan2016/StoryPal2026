"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import StoryPlayer from "./StoryPlayer";
import PortalDashboard from "./PortalDashboard";
import PortalShell from "./PortalShell";
import { PortalLanding } from "./PortalAuth";
import { detachProfileFromStories, getProfileStories } from "../lib/portalData";
import { createDefaultModules, getMissingDefaultModules } from "../lib/defaultModules";
import PortalJournal from "./PortalJournal";

import StoryModules from "./StoryModules";
import { useTranslation } from "../hooks/useTranslation";
import { auth, db } from "../lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { AlertTriangle, Check, LoaderCircle, RotateCcw } from "lucide-react";
import { generateModuleGuides } from "../lib/parentGuides";

/** @module Legacy cache compatibility */
const STORAGE_KEY = "storypal.modules";
const PASSPORTS_KEY = "storypal.passports";
const REFLECTIONS_KEY = "storypal.reflections";

function scopedKey(base, uid) {
  return uid ? `${base}.${uid}` : base;
}

function loadModulesFromStorage(uid) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(STORAGE_KEY, uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveModulesToStorage(modules, uid) {
  if (typeof window === "undefined") return;
  // Cache data for the current account.
  window.localStorage.setItem(
    scopedKey(STORAGE_KEY, uid),
    JSON.stringify(modules),
  );
  // Also maintain the compatibility cache used by the child page.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
}

function loadPassportsFromStorage(uid) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(PASSPORTS_KEY, uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePassportsToStorage(passports, uid) {
  if (typeof window === "undefined") return;
  // Cache data for the current account.
  window.localStorage.setItem(
    scopedKey(PASSPORTS_KEY, uid),
    JSON.stringify(passports),
  );
  // Also maintain the compatibility cache used by the child page.
  window.localStorage.setItem(PASSPORTS_KEY, JSON.stringify(passports));
}

function loadReflectionsFromStorage(uid) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(REFLECTIONS_KEY, uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReflectionsToStorage(reflections, uid) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    scopedKey(REFLECTIONS_KEY, uid),
    JSON.stringify(reflections),
  );
}

/** @module Parent training content */
const PARENT_TRAINING_MODULE = {
  id: "parent-training",
  title: "Interactive Parent Training: The Science of StoryPal & Co‑Action",
  coverImage: "",
  fontPreset: "classic",
  steps: [
    {
      type: "doctor",
      message:
        "Welcome to StoryPal! This short training shows you how StoryPal uses simple stories and visuals to support your child's social and emotional growth.",
    },
    {
      type: "doctor",
      message:
        "StoryPal is built on narrative therapy, co‑regulation, and neurodiversity‑affirming practice. Instead of 'fixing' your child, we celebrate their strengths and give them scaffolds for tricky moments.",
    },
    {
      type: "doctor",
      message:
        'One key idea is "Co‑Action": you and your child acting together. You model the skill, co‑play the action, and then gradually hand more control to your child when they feel ready.',
    },
    {
      type: "choice",
      message: "How familiar does Co‑Action feel to you right now?",
      options: [
        "Very new concept for me",
        "I’ve heard of similar ideas",
        "I already use something like this",
      ],
    },
    {
      type: "doctor",
      message:
        "In StoryPal, each step is a small Co‑Action moment: you read or listen together, pause to check in, and sometimes practice the move in real life—a wave, a deep breath, or asking for help.",
    },
    {
      type: "user-input",
      message:
        "Think of one everyday situation where you’d like StoryPal to help your child. Type a quick note so you remember it later.",
      placeholder: "e.g., saying hello at school drop‑off, waiting in a line…",
    },
    {
      type: "doctor",
      message:
        'Beautiful. As you build stories, keep coming back to Co-Action: "How can we try this together, side-by-side, in a way that feels safe and playful?" You\'re not alone—StoryPal is here to coach you step by step.',
    },
  ],
};

/** @module Parent portal state and authentication */
export default function ParentPortal({ initialProfileId = null }) {
  const router = useRouter();
  const { t } = useTranslation();
  const savedModulesRef = useRef(null);
  const storyBuilderRef = useRef(null);
  const [modules, setModules] = useState([]);
  const [passports, setPassports] = useState([]);
  const [selectedPassportId, setSelectedPassportId] = useState(null);
  /** @module Local reflection journal state */
  const [reflections, setReflections] = useState([]);
  /** @module Legacy storybook editing and preview state */
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [storyDraft, setStoryDraft] = useState(null);
  const [showStoryBuilder, setShowStoryBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewModule, setPreviewModule] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  /** @module Authentication state and account data loading */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setModules([]);
      setPassports([]);
      setReflections([]);
      setModulesLoading(true);
      if (!user) {
        setAuthReady(false);
        setAuthChecking(false);
        setCurrentUser(null);
        // Clear the account identifier used by the child page.
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("storypal.parent.uid");
        }

        return;
      }
      setCurrentUser(user);
      setAuthReady(true);
      setAuthChecking(false);
      // The child page uses this identifier to load the current account's content.
      if (typeof window !== "undefined") {
        window.localStorage.setItem("storypal.parent.uid", user.uid);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authReady || !currentUser) return;
    let cancelled = false;

    async function loadData() {
      setModulesLoading(true);
      setDataError("");
      const uid = currentUser.uid;
      let loadedCloudModules = null;
      let loadedCloudPassports = null;
      try {
        const snap = await getDocs(collection(db, "users", uid, "modules"));
        const cloudModules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        loadedCloudModules = cloudModules;

        if (!cancelled) {
          setModules(cloudModules);
          saveModulesToStorage(cloudModules, uid);
        }
      } catch (err) {
        console.error("Failed to load modules from Firestore", err);
        if (!cancelled) {
          setModules(
            loadModulesFromStorage(uid),
          );
          setDataError(
            "Cloud data could not be loaded. Showing available local data.",
          );
        }
      }

      // Load communication passports from the cloud.
      try {
        const passportSnap = await getDocs(
          collection(db, "users", uid, "passports"),
        );
        const cloudPassports = passportSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        loadedCloudPassports = cloudPassports;
        if (!cancelled) {
          setPassports(cloudPassports);
          savePassportsToStorage(cloudPassports, uid);
          if (cloudPassports.length > 0) {
            setSelectedPassportId(cloudPassports[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load passports from Firestore", err);
        if (!cancelled)
          setDataError(
            "Cloud data could not be loaded. Showing available local data.",
          );
        // Fall back to the current account's cache when cloud data is unavailable.
        const loadedPassports = loadPassportsFromStorage(uid);
        if (!cancelled) {
          setPassports(loadedPassports);
          if (loadedPassports.length > 0) {
            setSelectedPassportId(loadedPassports[0].id);
          }
        }
      }

      // Backfill only after both cloud reads succeed, so missing cache entries are not mistaken for missing cloud records.
      if (!cancelled && loadedCloudModules && loadedCloudPassports) {
        const missing = getMissingDefaultModules(loadedCloudModules, loadedCloudPassports);
        const mergedModules = new Map(loadedCloudModules.map(story => [story.id, story]));
        try {
          for (let offset = 0; offset < missing.length && !cancelled; offset += 400) {
            const candidates = missing.slice(offset, offset + 400);
            const prepared = await runTransaction(db, async transaction => {
              const refs = candidates.map(story => doc(db, "users", uid, "modules", story.id));
              const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
              return candidates.map((story, index) => {
                // Preserve storybooks created or edited concurrently in another page. Never overwrite them with defaults.
                if (snapshots[index].exists()) return { ...snapshots[index].data(), id: story.id };
                transaction.set(refs[index], story);
                return story;
              });
            });
            prepared.forEach(story => mergedModules.set(story.id, story));
            if (!cancelled) {
              const next = Array.from(mergedModules.values());
              setModules(next);
              saveModulesToStorage(next, uid);
            }
          }
        } catch (error) {
          console.error("Failed to prepare default stories", error);
          if (!cancelled) setDataError("Default stories could not be prepared. Please try again.");
        }
      }

      if (!cancelled) {
        setReflections(loadReflectionsFromStorage(uid));
        setModulesLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser]);

  const showAuthGate = authChecking || !authReady;

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Failed to sign out", err);
    }
  }, [router]);

  useEffect(() => {
    function handleLogoutRequest() {
      handleSignOut();
    }
    window.addEventListener("request-logout", handleLogoutRequest);
    return () => {
      window.removeEventListener("request-logout", handleLogoutRequest);
    };
  }, [handleSignOut]);

  /** @module Storybook context compatibility */
  function buildContextFromPassport(p) {
    if (!p) return {};
    return {
      child: {
        name: p.childName || "",
        age: p.age || "",
        avatar: p.avatar || "",
        pronouns: {
          subject: p.pronouns?.subject || "",
          object: p.pronouns?.object || "",
          possessiveAdjective: p.pronouns?.possessiveAdjective || "",
          possessivePronoun: p.pronouns?.possessivePronoun || "",
        },
      },
      communication: {
        modalities: (p.communication?.modalities || []).join(", "),
        comprehensionLevel: p.communication?.comprehensionLevel || "",
        latency: p.communication?.latency || "",
        yesNoConventions: p.communication?.yesNoConventions || "",
        dontUnderstandSignals: p.communication?.dontUnderstandSignals || "",
      },
      sensory: { ...p.sensory },
      preferences: {
        reinforcement: p.interaction?.reinforcementPreferences || "",
        interests: p.interaction?.interests || "",
        dosDonts: p.interaction?.dosDonts || "",
        identityLanguage: p.interaction?.identityLanguage || "",
        culturalContext: p.interaction?.culturalContext || "",
      },
      access: {
        accessibilityNeeds: p.accessSafety?.accessibilityNeeds || "",
        deescalationStrategies: p.accessSafety?.deescalationStrategies || "",
        caregiverNotes: p.accessSafety?.caregiverNotes || "",
        consentScope: p.accessSafety?.consentScope || "",
      },
    };
  }

  /** @module Display filtering preserves raw data and leaves deletion and caching unaffected */
  const profileStories = useMemo(() => getProfileStories(modules, passports), [modules, passports]);

  const selectedPassport = useMemo(
    () => passports.find((p) => p.id === selectedPassportId) || null,
    [passports, selectedPassportId],
  );

  async function deleteModule(id) {
    const next = modules.filter((m) => m.id !== id);
    if (currentUser?.uid) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "modules", id));
      } catch (err) {
        console.error("Failed to delete module from Firestore", err);
        throw err;
      }
    }
    setModules(next);
    saveModulesToStorage(next, currentUser?.uid);
    if (editingModuleId === id) {
      setEditingModuleId(null);
      setShowStoryBuilder(false);
    }
  }

  /** @module Parent guide generation on save */
  const [savingModule, setSavingModule] = useState(false);
  const savingModuleRef = useRef(false);
  const [guideProgress, setGuideProgress] = useState(null);
  const [guideFailure, setGuideFailure] = useState(null);
  const guideDecisionRef = useRef(null);

  /** Show failed steps and let the user save partial results or retry those steps. */
  function handleGuideFailure(failure) {
    setGuideFailure(failure);
    return new Promise((resolve) => {
      guideDecisionRef.current = resolve;
    });
  }

  /** @module Recovery options for guide generation failures */
  function handleGuideDecision(savePartial) {
    const resolve = guideDecisionRef.current;
    guideDecisionRef.current = null;
    setGuideFailure(null);
    resolve?.(savePartial);
  }

  async function handleModuleSave(moduleDefinition, initialSteps) {
    if (savingModuleRef.current) return;
    savingModuleRef.current = true;
    setSavingModule(true);
    try {
      const passport = passports.find(
        (item) => item.id === moduleDefinition.childId,
      );
      const steps = await generateModuleGuides(
        moduleDefinition,
        editingModuleId ? initialSteps : [],
        passport ? buildContextFromPassport(passport) : {},
        { onProgress: setGuideProgress, onFailure: handleGuideFailure },
      );
      await persistModule({ ...moduleDefinition, steps });
    } catch (error) {
      console.error("Failed to save story", error);
      window.alert(
        t("Story could not be saved. Your edits are still available. Please try again."),
      );
    } finally {
      savingModuleRef.current = false;
      setSavingModule(false);
      setGuideProgress(null);
      setGuideFailure(null);
    }
  }

  async function persistModule(moduleDefinition) {
    const uid = currentUser?.uid;
    const moduleWithMeta = {
      ...moduleDefinition,
      createdAt: moduleDefinition.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (uid) {
      await setDoc(doc(db, "users", uid, "modules", moduleWithMeta.id), {
        ...moduleWithMeta, updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    const next = [...modules];
    const existingIdx = next.findIndex((m) => m.id === moduleWithMeta.id);
    if (existingIdx >= 0) {
      next[existingIdx] = moduleWithMeta;
    } else {
      next.unshift(moduleWithMeta);
    }
    setModules(next);
    saveModulesToStorage(next, uid);
    setEditingModuleId(null);
    setShowStoryBuilder(false);

    // Return to the previous position in the storybook list after saving.
    setTimeout(() => {
      if (savedModulesRef.current) {
        savedModulesRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);

  }

  function handleModulePreview(modulePreview) {
    setPreviewModule(modulePreview);
    setShowPreview(true);
  }

  function handleModuleEdit(module) {
    setEditingModuleId(module.id);
    setShowStoryBuilder(true);
  }

  function openCreateStory() {
    setEditingModuleId(null);
    setShowStoryBuilder(true);
  }

  function closeStoryBuilder() {
    if (savingModuleRef.current) return;
    setShowStoryBuilder(false);
    setEditingModuleId(null);
  }

  // Lock background scrolling while the creation dialog is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!showStoryBuilder) return;

    // Move focus into the dialog, trap Tab navigation, and restore focus on close.
    const previousFocus = document.activeElement;
    const dialog = storyBuilderRef.current;
    const getControls = () => Array.from(dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(element => element.getClientRects().length);
    getControls()[0]?.focus();
    function handleDialogKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!savingModuleRef.current) {
          setShowStoryBuilder(false);
          setEditingModuleId(null);
        }
      }
      if (event.key !== "Tab") return;
      const controls = getControls();
      const first = controls[0];
      const last = controls.at(-1);
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }
    dialog?.addEventListener("keydown", handleDialogKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      dialog?.removeEventListener("keydown", handleDialogKey);
      previousFocus?.focus();
    };
  }, [showStoryBuilder]);

  /** @module Portal profile persistence */
  async function handleSavePassport(passport) {
    // Save the new profile and default storybooks atomically to avoid partially created profiles.
    const isNew = !passports.some(p => p.id === passport.id);
    const defaults = isNew ? createDefaultModules(passport.id) : [];
    const batch = writeBatch(db);
    batch.set(doc(db, "users", currentUser.uid, "passports", passport.id), { ...passport, updatedAt: serverTimestamp() }, { merge: true });
    defaults.forEach(story => batch.set(doc(db, "users", currentUser.uid, "modules", story.id), story));
    await batch.commit();
    if (defaults.length) {
      const nextModules = [...modules, ...defaults];
      setModules(nextModules);
      saveModulesToStorage(nextModules, currentUser.uid);
    }
    const next = passports.some((p) => p.id === passport.id)
      ? passports.map((p) => (p.id === passport.id ? passport : p))
      : [...passports, passport];
    setPassports(next);
    savePassportsToStorage(next, currentUser.uid);
    setSelectedPassportId(passport.id);
  }

  /** Unlink storybooks in batches before deleting the profile. Keep the profile available for retry if unlinking fails. */
  async function handleDeletePassport(id) {
    const snapshot = await getDocs(
      collection(db, "users", currentUser.uid, "modules"),
    );
    const linked = snapshot.docs.filter((item) => item.data().childId === id);
    for (let offset = 0; offset < linked.length; offset += 400) {
      const batch = writeBatch(db);
      linked.slice(offset, offset + 400).forEach((item) =>
        batch.update(item.ref, {
          childId: null,
          updatedAt: serverTimestamp(),
        }),
      );
      await batch.commit();
    }
    await deleteDoc(doc(db, "users", currentUser.uid, "passports", id));
    const next = passports.filter((p) => p.id !== id);
    const allModules = detachProfileFromStories(
      snapshot.docs.map((item) => ({ ...item.data(), id: item.id })),
      id,
    );
    setPassports(next);
    savePassportsToStorage(next, currentUser.uid);
    setModules(allModules);
    saveModulesToStorage(allModules, currentUser.uid);
    if (selectedPassportId === id) setSelectedPassportId(next[0]?.id || null);
  }

  if (authChecking)
    return (
      <PortalShell>
        <main className="workspace" role="status">
          {t("Loading…")}
        </main>
      </PortalShell>
    );
  if (showAuthGate)
    return (
      <PortalShell>
        <PortalLanding />
      </PortalShell>
    );

  return (
    <>
      <PortalShell>
        <div ref={savedModulesRef}>
          <PortalDashboard
            initialProfileId={initialProfileId}
            onSignOut={handleSignOut}
            user={currentUser}
            passports={passports}
            modules={profileStories}
            loading={modulesLoading}
            loadError={dataError}
            onSavePassport={handleSavePassport}
            onDeletePassport={handleDeletePassport}
            onCreate={(id, moment = "") => {
              setSelectedPassportId(id);
              setStoryDraft({
                childId: id,
                title: moment,
                stageDesign: {
                  framing: {
                    focus: "greeting",
                    scenario: "school",
                    tone: "brave",
                    parentGoal: "",
                  },
                },
              });
              openCreateStory();
            }}
            onEdit={(story) => {
              setSelectedPassportId(story.childId);
              handleModuleEdit(story);
            }}
            onRead={(story) => {
              setSelectedPassportId(story.childId);
              setPreviewModule(story);
              setShowPreview(true);
            }}
            onDeleteStory={deleteModule}
            onTraining={() => {
              setPreviewModule(PARENT_TRAINING_MODULE);
              setShowPreview(true);
            }}
            journal={
              <PortalJournal
                modules={profileStories}
                reflections={reflections}
                onSave={(reflectionData) => {
                  const reflection = {
                    id: reflectionData.id || `${Date.now()}`,
                    storyId: reflectionData.storyId,
                    childComfort: reflectionData.childComfort,
                    parentConfidence: reflectionData.parentConfidence,
                    observations: reflectionData.observations.trim(),
                    successMoments: reflectionData.successMoments.trim(),
                    createdAt: reflectionData.id
                      ? reflections.find((r) => r.id === reflectionData.id)
                          ?.createdAt || new Date().toISOString()
                      : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  const next = [...reflections];
                  const existingIdx = next.findIndex(
                    (r) => r.id === reflection.id,
                  );
                  if (existingIdx >= 0) {
                    next[existingIdx] = reflection;
                  } else {
                    next.push(reflection);
                  }
                  setReflections(next);
                  saveReflectionsToStorage(next, currentUser?.uid);
                }}
                onDelete={(id) => {
                  const next = reflections.filter((r) => r.id !== id);
                  setReflections(next);
                  saveReflectionsToStorage(next, currentUser?.uid);
                }}
              />
            }
          />
        </div>
      </PortalShell>

      {showStoryBuilder && passports.length > 0 && (
        <div className="storypal-builder fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeStoryBuilder}
            aria-hidden="true"
          />
          <div ref={storyBuilderRef} role="dialog" aria-modal="true" aria-label={t("Story editor")} className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white/95 backdrop-blur border border-zinc-200 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white/90 backdrop-blur">
              <div>
                <div className="text-xl font-semibold text-zinc-900">
                  {editingModuleId ? t("Edit story") : t("Create story")}
                </div>
                <div className="text-sm text-zinc-600">{t("Build and preview stories, then save to your account.")}</div>
              </div>
              <button
                type="button"
                onClick={closeStoryBuilder}
                disabled={savingModule}
                data-telemetry="parent_story_builder_close"
                className="rounded-xl px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 disabled:opacity-50"
              >
                {t("close")}
              </button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-80px)] relative">
              {savingModule && (
                <div
                  className={`sticky top-0 z-10 mb-5 rounded-2xl border p-4 shadow-sm sm:p-5 ${guideFailure ? "border-amber-200 bg-amber-50" : "border-purple-200 bg-purple-50"}`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white ${guideFailure ? "border-amber-200 text-amber-700" : "border-purple-200 text-[#315e4a]"}`}
                    >
                      {guideFailure ? (
                        <AlertTriangle className="size-5" aria-hidden="true" />
                      ) : (
                        <LoaderCircle
                          className="size-5 motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {guideFailure ? (
                        <>
                          <div role="alert" className="space-y-1">
                            <h3 className="text-sm font-semibold leading-6 text-amber-950">
                              {guideFailure.timedOut
                                ? t("Guide generation timed out.")
                                : t("Some parent guides could not be generated.")}
                            </h3>
                            <p className="text-sm leading-6 text-amber-900">{t("Your edits and successful guides are retained.")}</p>
                            <p className="flex flex-wrap items-center gap-2 pt-2 text-xs font-medium text-amber-900">
                              <span>{t("Steps to retry:")}</span>
                              {guideFailure.failedSteps.map((step) => (
                                <span
                                  key={step}
                                  className="inline-flex min-w-7 items-center justify-center rounded-lg border border-amber-200 bg-white px-2 py-1 tabular-nums"
                                >
                                  {step}
                                </span>
                              ))}
                            </p>
                          </div>
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                            <button
                              type="button"
                              onClick={() => handleGuideDecision(true)}
                              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#315e4a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#244a39] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
                            >
                              <Check className="size-4" aria-hidden="true" />{t("Save existing results")}</button>
                            <button
                              type="button"
                              onClick={() => handleGuideDecision(false)}
                              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors duration-200 hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                            >
                              <RotateCcw
                                className="size-4"
                                aria-hidden="true"
                              />{t("Retry failed steps")}</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            role="status"
                            aria-atomic="true"
                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                          >
                            <h3 className="text-sm font-semibold leading-6 text-[#315e4a]">
                              {guideProgress
                                ? t("Processing parent guides")
                                : t("Preparing parent guides…")}
                            </h3>
                            {guideProgress && (
                              <span className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-[#315e4a]">
                                {guideProgress.completed} /{" "}
                                {guideProgress.total}
                              </span>
                            )}
                          </div>
                          {guideProgress && guideProgress.total > 0 && (
                            <progress
                              aria-label={t("Parent guide processing progress")}
                              value={guideProgress.completed}
                              max={guideProgress.total}
                              className="mt-3 block h-2 w-full overflow-hidden rounded-full border-0 bg-purple-100 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-purple-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#315e4a] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#315e4a]"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <StoryModules
                passports={passports}
                onSave={handleModuleSave}
                saving={savingModule}
                onPreview={handleModulePreview}
                initialData={
                  editingModuleId
                    ? modules.find((m) => m.id === editingModuleId)
                    : storyDraft
                }
              />
            </div>
          </div>
        </div>
      )}

      {showPreview && previewModule && (
        <StoryPlayer
          moduleDefinition={previewModule}
          templateContext={
            previewModule.id === "parent-training" || !selectedPassport
              ? {}
              : buildContextFromPassport(selectedPassport)
          }
          onClose={() => {
            setShowPreview(false);
            setPreviewModule(null);
          }}
          onFinished={() => {
            setShowPreview(false);
            setPreviewModule(null);
          }}
        />
      )}
    </>
  );
}
