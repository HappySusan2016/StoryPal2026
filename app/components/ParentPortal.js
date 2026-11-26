"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StoryPlayer, { interpolateStoryText } from "./StoryPlayer";
import PortalDashboard from "./PortalDashboard";
import PortalShell from "./PortalShell";
import { PortalLanding } from "./PortalAuth";
import { detachProfileFromStories, getProfileStories } from "../lib/portalData";
import { hasDuplicateChildName } from "../lib/passportFields";
import { getMissingDefaultModules } from "../lib/defaultModules";
import PortalJournal from "./PortalJournal";

import StoryModules from "./StoryModules";
import StoryWorkshop from "./StoryWorkshop";
import workshopStyles from "./StoryWorkshop.module.css";
import { defaultStoryPronouns, getStoryGenerationKey } from "../lib/storyWorkshop";
import { saveWorkshopChild } from "../lib/workshopSelection";
import { useTranslation } from "../hooks/useTranslation";
import { auth, db } from "../lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { awardReadingStars, saveReadingPage } from "../lib/readingSessions";

/** @module Legacy cache compatibility */
const STORAGE_KEY = "storypal.modules";
const PASSPORTS_KEY = "storypal.passports";
const REFLECTIONS_KEY = "storypal.reflections";
const STORY_DRAFT_KEY = "storypal.story-draft";

function scopedKey(base, uid) {
  return uid ? `${base}.${uid}` : base;
}

/** @module Story drafts for the current tab */
function workshopDraftKey(uid, draftId) {
  return `${scopedKey(STORY_DRAFT_KEY, uid)}.${draftId}`;
}

function getWorkshopDraft(uid, draftId) {
  if (!uid || !draftId) return null;
  try {
    const draft = JSON.parse(sessionStorage.getItem(workshopDraftKey(uid, draftId))
      ?? sessionStorage.getItem(scopedKey(STORY_DRAFT_KEY, uid)));
    return draft?.draftId === draftId && typeof draft.title === "string" ? draft : null;
  } catch {
    return null;
  }
}

function getWorkshopEdits(key) {
  if (!key) return null;
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function clearWorkshopEdits(key) {
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Continue navigation if local draft cleanup fails after a successful cloud save.
  }
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
export default function ParentPortal({ initialProfileId = null, storyEditor = null, storyReader = null }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  const [passports, setPassports] = useState([]);
  /** @module Local reflection journal state */
  const [reflections, setReflections] = useState([]);
  /** @module Parent training dialog */
  const [showTraining, setShowTraining] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [readingSaveError, setReadingSaveError] = useState(false);
  const readingSessionRef = useRef(null);

  /** @module Authentication state and account data loading */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      readingSessionRef.current = null;
      setReadingSaveError(false);
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
      try {
        const snap = await getDocs(collection(db, "users", uid, "modules"));
        const cloudModules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

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
        if (!cancelled) {
          setPassports(cloudPassports);
          savePassportsToStorage(cloudPassports, uid);
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
          ...Object.fromEntries(Object.entries(defaultStoryPronouns).map(([field, fallback]) =>
            [field, p.pronouns?.[field]?.trim() || fallback])),
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
  }

  /** @module Story save state */
  const [savingModule, setSavingModule] = useState(false);
  const savingModuleRef = useRef(false);

  async function handleModuleSave(moduleDefinition) {
    if (savingModuleRef.current) return;
    savingModuleRef.current = true;
    setSavingModule(true);
    try {
      await persistModule(moduleDefinition);
    } catch (error) {
      console.error("Failed to save story", error);
      window.alert(t("Story could not be saved. Your edits are still available. Please try again."));
    } finally {
      savingModuleRef.current = false;
      setSavingModule(false);
    }
  }

  /** @module Storybook, profile, and return path */
  const storyPage = storyReader || storyEditor;
  const existingStory = storyPage?.storyId
    ? modules.find((story) => story.id === storyPage.storyId)
    : null;
  const childReader = storyReader?.childMode === true;
  const workshopStory = useRef(null);
  const draft = getWorkshopDraft(currentUser?.uid, storyEditor?.draftId);
  const draftStorageKey = draft?.generation?.storyId
    ? `${workshopDraftKey(currentUser.uid, draft.draftId)}.edits.${draft.generation.storyId}` : "";
  const unsavedWorkshopEdits = getWorkshopEdits(draftStorageKey);
  const hasPendingWorkshopStory = Boolean(draft?.generation
    && (draft.generation.awaitingEditorSave !== false || unsavedWorkshopEdits));
  const workshopReturn = Boolean(storyEditor?.storyId && draft?.generation?.storyId === storyEditor.storyId);
  const pendingStory = workshopReturn && !existingStory ? draft.generation.story : null;
  const storyPassport = passports.find((passport) =>
    passport.id === (existingStory?.childId ?? pendingStory?.childId ?? storyEditor?.childId));
  const workshopHref = workshopReturn ? `/stories/new?${new URLSearchParams({
    child: draft.childId,
    draft: draft.draftId,
    ...(draft.fromProfile && { from: "profile" }),
  })}` : null;
  const bookshelfHref = childReader && storyReader.bookshelfProfile !== null
    ? `/child?profile=${encodeURIComponent(storyReader.bookshelfProfile)}`
    : "/child";
  const storyOriginHref = storyPage?.fromProfile && storyPassport
    ? `/profiles/${encodeURIComponent(storyPassport.id)}`
    : "/";
  const storyBackHref = workshopHref || (childReader ? bookshelfHref : storyOriginHref);

  /** @module Child reading progress and rewards */
  function handleChildPageConfirmed(pageIndex, completed) {
    const uid = currentUser?.uid;
    if (!uid || auth.currentUser?.uid !== uid || !storyPassport || !existingStory) return;
    const session = readingSessionRef.current;
    if (session?.childId !== storyPassport.id || session?.moduleId !== existingStory.id) {
      readingSessionRef.current = {
        id: crypto.randomUUID(),
        childId: storyPassport.id,
        moduleId: existingStory.id,
      };
    }
    saveReadingPage(uid, readingSessionRef.current, pageIndex, completed).catch((error) => {
      console.error("Failed to save reading page", error);
      if (auth.currentUser?.uid === uid) setReadingSaveError(true);
    });
  }

  function handleChildStarsCollected(childId, moduleId, stars) {
    const uid = currentUser?.uid;
    if (!uid || auth.currentUser?.uid !== uid || childId !== storyPassport?.id || moduleId !== existingStory?.id) {
      return Promise.reject(new Error("Reading account changed"));
    }
    const session = readingSessionRef.current;
    if (session?.childId !== childId || session?.moduleId !== moduleId) {
      return Promise.reject(new Error("Reading session changed"));
    }
    return awardReadingStars(uid, session, stars);
  }

  function handleReadAgain() {
    readingSessionRef.current = null;
    setReadingSaveError(false);
  }

  /** @module Storybook persistence */
  async function persistModule(moduleDefinition) {
    const uid = currentUser?.uid;
    if (!uid || auth.currentUser?.uid !== uid) throw new Error(t("Please sign in again."));
    const storyRef = doc(db, "users", uid, "modules", moduleDefinition.id);
    const updatedAt = new Date().toISOString();
    const changes = { ...moduleDefinition, updatedAt: serverTimestamp() };
    // Update only editable fields to preserve the creation time and avoid recreating deleted records.
    if (pendingStory) {
      if (!moduleDefinition.childId) throw new Error(t("Profile not found."));
      const passportRef = doc(db, "users", uid, "passports", moduleDefinition.childId);
      await runTransaction(db, async (transaction) => {
        const saved = await transaction.get(storyRef);
        if (saved.exists()) throw new Error(t("Could not save changes. Please try again."));
        const passport = await transaction.get(passportRef);
        if (!passport.exists()) throw new Error(t("Profile not found."));
        transaction.set(storyRef, { ...changes, createdAt: updatedAt });
      });
    } else if (existingStory) {
      await updateDoc(storyRef, changes);
    } else {
      await setDoc(storyRef, { ...changes, createdAt: updatedAt });
    }
    // Expand the child associated with the saved story when returning home.
    if (storyOriginHref === "/") saveWorkshopChild(uid, moduleDefinition.childId);
    if (workshopReturn) {
      clearWorkshopEdits(draftStorageKey);
      try {
        // Clear local content after saving to the cloud, keeping only the generation record needed to reopen the story.
        const currentDraft = getWorkshopDraft(uid, draft.draftId);
        if (currentDraft?.generation?.storyId === moduleDefinition.id) {
          const generation = { ...currentDraft.generation, awaitingEditorSave: false };
          delete generation.story;
          sessionStorage.setItem(workshopDraftKey(uid, draft.draftId), JSON.stringify({
            ...currentDraft, generation,
          }));
        }
      } catch {
        // Continue navigation if the session record fails to save after a successful cloud save.
      }
    }
    const savedStory = {
      ...(existingStory || { createdAt: updatedAt }),
      ...moduleDefinition,
      updatedAt,
    };
    const next = existingStory
      ? modules.map((story) => story.id === savedStory.id ? savedStory : story)
      : [savedStory, ...modules];
    setModules(next);
    try {
      saveModulesToStorage(next, uid);
    } catch (error) {
      // Return to the list even if the cache write fails after the cloud save.
      console.error("Failed to cache story", error);
    }
    router.replace(storyOriginHref);
  }

  /** @module Full AI story generation and save retries */
  function openWorkshopEditor(storyId) {
    const params = new URLSearchParams({ draft: draft.draftId });
    if (storyEditor.fromProfile) params.set("from", "profile");
    router.push(`/stories/${encodeURIComponent(storyId)}/edit?${params}`);
  }

  async function handleWorkshopGenerate(input, focusTouched, replaceEdits) {
    const user = currentUser;
    const title = draft?.title.trim();
    if (!title || !user || auth.currentUser?.uid !== user.uid) {
      throw new Error(t("Could not save changes. Please try again."));
    }
    const key = getStoryGenerationKey(title, input);
    const previous = draft.generation;
    const replacedStoryId = replaceEdits ? previous?.storyId : undefined;
    if (!replaceEdits && previous?.key === key) {
      const alreadyLoaded = previous.story || modules.some(({ id }) => id === previous.storyId);
      if (alreadyLoaded || (await getDocFromServer(doc(db, "users", user.uid, "modules", previous.storyId))).exists()) {
        if (auth.currentUser?.uid !== user.uid) throw new Error(t("Please sign in again."));
        openWorkshopEditor(previous.storyId);
        return;
      }
    }
    if (workshopStory.current?.key !== key || workshopStory.current?.uid !== user.uid
      || workshopStory.current?.replacedStoryId !== replacedStoryId) {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.reason || result.error || "Could not generate the story. Please try again.");
      workshopStory.current = {
        key,
        uid: user.uid,
        replacedStoryId,
        story: {
          id: `ai-${crypto.randomUUID()}`,
          childId: input.childId,
          title,
          coverImage: "/default-story-cover.svg",
          fontPreset: "classic",
          steps: result.steps,
        },
      };
    }
    if (auth.currentUser?.uid !== user.uid) throw new Error(t("Please sign in again."));
    // Keep the generated story in the tab until the user explicitly saves it to the cloud from the editor.
    const { story } = workshopStory.current;
    sessionStorage.setItem(workshopDraftKey(user.uid, draft.draftId), JSON.stringify({
      ...draft,
      childId: draft.childId || storyEditor.childId,
      fromProfile: storyEditor.fromProfile,
      generation: { key, storyId: story.id, input, focusTouched, awaitingEditorSave: true, story },
    }));
    if (replaceEdits) clearWorkshopEdits(draftStorageKey);
    openWorkshopEditor(story.id);
  }

  /** @module Opening the editor from the story list */
  function handleModuleEdit(story) {
    // Remember which child owns the story before leaving home so its section reopens on return or browser Back.
    if (!initialProfileId) saveWorkshopChild(currentUser?.uid, story.childId);
    const href = `/stories/${encodeURIComponent(story.id)}/edit`;
    router.push(initialProfileId ? `${href}?from=profile` : href);
  }

  /** @module Creation page navigation and title handoff */
  function handleCreateStory(childId, title = "") {
    const params = new URLSearchParams({ child: childId });
    if (initialProfileId) params.set("from", "profile");
    if (title) {
      // The title may contain personal information, so pass it through this tab's session storage.
      try {
        const draftId = crypto.randomUUID();
        sessionStorage.setItem(workshopDraftKey(currentUser.uid, draftId), JSON.stringify({
          draftId, title, childId, fromProfile: Boolean(initialProfileId),
        }));
        params.set("draft", draftId);
      } catch {
        window.alert(t("Could not save changes. Please try again."));
        return;
      }
    }
    if (!initialProfileId) saveWorkshopChild(currentUser?.uid, childId);
    router.push(`/stories/new?${params}`);
  }

  /** @module Child profile saving */
  async function handleSavePassport(passport) {
    const uid = currentUser.uid;
    const accountRef = doc(db, "users", uid);
    const passportsRef = collection(accountRef, "passports");
    const passportRef = doc(passportsRef, passport.id);
    // Keep the creation time stable across transaction retries and later edits.
    const newCreatedAt = new Date().toISOString();
    const { defaults, createdAt } = await runTransaction(db, async (transaction) => {
      // All profile saves read and write the same account document so concurrent saves across tabs recheck the latest profile list.
      await transaction.get(accountRef);
      const existing = await transaction.get(passportRef);
      const snapshot = await getDocsFromServer(passportsRef);
      const currentPassports = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
      if (hasDuplicateChildName(passport, currentPassports, existing.data())) {
        throw Object.assign(new Error("Duplicate child name"), { code: "duplicate-child-name" });
      }

      // Initialize storybooks only on the first save from the profile details page. Commit the completion flag and storybooks with the profile.
      const initializeStories = initialProfileId === passport.id &&
        !existing.data()?.defaultStoriesInitializedAt;
      let stories = [];
      if (initializeStories) {
        const modulesRef = collection(accountRef, "modules");
        const linked = await getDocsFromServer(query(modulesRef, where("childId", "==", passport.id)));
        const linkedStories = linked.docs.map(item => ({ ...item.data(), id: item.id }));
        const missing = getMissingDefaultModules(linkedStories, [passport]);
        const refs = missing.map(story => doc(modulesRef, story.id));
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        // Read the candidate documents within the transaction to avoid overwriting storybooks written after the query.
        stories = missing.filter((story, index) => {
          if (snapshots[index].exists()) return false;
          transaction.set(refs[index], story);
          return true;
        });
      }

      const createdAt = existing.exists() ? existing.data().createdAt : newCreatedAt;
      transaction.set(accountRef, { passportsUpdatedAt: serverTimestamp() }, { merge: true });
      transaction.set(passportRef, {
        ...passport,
        ...(createdAt != null && { createdAt }),
        updatedAt: serverTimestamp(),
        ...(initializeStories && { defaultStoriesInitializedAt: serverTimestamp() }),
      }, { merge: true });
      return { defaults: stories, createdAt };
    });
    if (defaults.length) {
      const newIds = new Set(defaults.map(story => story.id));
      const nextModules = [...modules.filter(story => !newIds.has(story.id)), ...defaults];
      setModules(nextModules);
      saveModulesToStorage(nextModules, currentUser.uid);
    }
    const savedPassport = { ...passport, ...(createdAt != null && { createdAt }) };
    const next = passports.some((p) => p.id === passport.id)
      ? passports.map((p) => (p.id === passport.id ? savedPassport : p))
      : [...passports, savedPassport];
    setPassports(next);
    savePassportsToStorage(next, currentUser.uid);
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
  }

  if (authChecking)
    return (
      <PortalShell childReading={childReader}>
        <main className="workspace" role="status">
          {t("Loading…")}
        </main>
      </PortalShell>
    );
  if (showAuthGate)
    return (
      <PortalShell childReading={childReader}>
        <PortalLanding />
      </PortalShell>
    );

  /** @module Shared layout for reading, creating, and editing storybooks */
  if (storyPage) {
    const backLabel = workshopReturn ? t("← Back to story workshop") : storyPage.fromProfile && storyPassport
      ? `← ${t("Back to {nickname}", { nickname: storyPassport.childName })}`
      : t("← Back to your space");
    const isEditing = Boolean(storyEditor?.storyId);
    const workshopTitle = draft?.title || "";
    const showWorkshop = !isEditing && Boolean(workshopTitle);
    const readerContext = storyReader ? buildContextFromPassport(storyPassport) : null;
    const title = storyReader
      ? interpolateStoryText(existingStory?.title, readerContext) || t("Read")
      : t(isEditing ? "Edit story" : "Create story");
    const storyError = storyPage.storyId
      ? ((!existingStory && !pendingStory) || (childReader && !storyPassport)) && (dataError || "Story not found.")
      : storyEditor.draftId && !workshopTitle
        ? "This story title is unavailable. Return to your space to start again."
        : !storyPassport && (storyEditor.childId
        ? "Profile not found."
        : !passports.length && "Create a communication passport to personalize stories for your child.");

    const showEditor = !storyReader && !showWorkshop && !modulesLoading && !storyError;
    const heading = (
      <div>
        {!childReader && (savingModule ? (
          <span className="story-editor-back" aria-disabled="true">{backLabel}</span>
        ) : (
          <Link className="story-editor-back" href={storyBackHref} replace={Boolean(workshopReturn)}>{backLabel}</Link>
        ))}
        {!showEditor && <h1>{title}</h1>}
        {!showEditor && storyPassport && <p className="muted">{storyPassport.childName}</p>}
      </div>
    );
    const showReader = storyReader && !modulesLoading && !storyError;

    return (
      <PortalShell childReading={childReader}>
        <main className={`reader-shell story-editor-page${storyReader ? " story-reading-page" : ""}${showWorkshop ? ` ${workshopStyles.page}` : ""}`}>
          {!showReader && (!showWorkshop || modulesLoading || storyError) && <header className="reader-top">{heading}</header>}
          {modulesLoading ? (
            <p role="status">{t("Loading…")}</p>
          ) : storyError ? (
            <p role="alert">{t(storyError)}</p>
          ) : (
            <>
              {dataError && <p role="status">{t(dataError)}</p>}
              {readingSaveError && <p role="alert">{t("Could not save changes. Please try again.")}</p>}
              <div className="story-editor-controls storypal-builder">
                {storyReader ? (
                  <StoryPlayer
                    layout="reader"
                    moduleDefinition={existingStory}
                    templateContext={readerContext}
                    readerHeading={heading}
                    childMode={childReader}
                    narrate={childReader}
                    childId={childReader ? storyPassport.id : null}
                    onStarsCollected={childReader ? handleChildStarsCollected : undefined}
                    onPageConfirmed={childReader ? handleChildPageConfirmed : undefined}
                    onReadAgain={childReader ? handleReadAgain : undefined}
                    onFinished={() => router.replace(storyBackHref)}
                  />
                ) : showWorkshop ? (
                  <StoryWorkshop
                    key={currentUser.uid}
                    passports={passports}
                    initialChildId={storyPassport?.id}
                    previousGeneration={draft.generation}
                    hasPendingStory={hasPendingWorkshopStory}
                    hasUnsavedEdits={Boolean(unsavedWorkshopEdits)}
                    onKeepEdits={() => openWorkshopEditor(draft.generation.storyId)}
                    getTemplateContext={buildContextFromPassport}
                    onGenerate={handleWorkshopGenerate}
                    title={workshopTitle}
                    backHref={storyBackHref}
                    backLabel={backLabel}
                  />
                ) : (
                  <StoryModules
                    passport={storyPassport}
                    initialData={existingStory || pendingStory || { childId: storyPassport?.id }}
                    isNewDraft={Boolean(pendingStory)}
                    generationInput={workshopReturn ? draft.generation.input : undefined}
                    unsavedEdits={workshopReturn ? unsavedWorkshopEdits : null}
                    draftStorageKey={workshopReturn ? draftStorageKey : ""}
                    getTemplateContext={buildContextFromPassport}
                    onSave={handleModuleSave}
                    saving={savingModule}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </PortalShell>
    );
  }

  return (
    <>
      <PortalShell>
        <PortalDashboard
          key={currentUser?.uid}
          initialProfileId={initialProfileId}
          onSignOut={handleSignOut}
          user={currentUser}
          passports={passports}
          modules={profileStories}
          loading={modulesLoading}
          loadError={dataError}
          onSavePassport={handleSavePassport}
          onDeletePassport={handleDeletePassport}
          onCreate={handleCreateStory}
          onEdit={handleModuleEdit}
          onDeleteStory={deleteModule}
          onTraining={() => setShowTraining(true)}
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
                // Update the list after the save succeeds. Keep the journal entry available for retry if the save fails.
                saveReflectionsToStorage(next, currentUser?.uid);
                setReflections(next);
              }}
            />
          }
        />
      </PortalShell>

      {showTraining && (
        <StoryPlayer
          moduleDefinition={PARENT_TRAINING_MODULE}
          onClose={() => setShowTraining(false)}
          hideParentGuide
        />
      )}
    </>
  );
}
