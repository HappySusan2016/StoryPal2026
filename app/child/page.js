"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PortalShell from "../components/PortalShell";
import PortalText from "../components/PortalText";
import PortalIllustration from "../components/PortalIllustration";
import StoryPlayer from "../components/StoryPlayer";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { getProfileStories } from "../lib/portalData";
import { saveReadingPage } from "../lib/readingSessions";
import { useTranslation } from "../hooks/useTranslation";

const STORAGE_KEY = "storypal.modules";
const PASSPORTS_KEY = "storypal.passports";
const PARENT_UID_KEY = "storypal.parent.uid";

function loadModulesFromStorage(uid) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}.${uid}`) || (window.localStorage.getItem(PARENT_UID_KEY) === uid ? window.localStorage.getItem(STORAGE_KEY) : null);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadPassportsFromStorage(uid) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${PASSPORTS_KEY}.${uid}`) || (window.localStorage.getItem(PARENT_UID_KEY) === uid ? window.localStorage.getItem(PASSPORTS_KEY) : null);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function buildContextFromPassport(p) {
  if (!p) return {};
  return {
    child: {
      name: p.childName || "",
      age: p.age || "",
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

export default function ChildPortal() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  const [passports, setPassports] = useState([]);
  const [selectedPassportId, setSelectedPassportId] = useState("");
  const [childStars, setChildStars] = useState({});
  const [parentUid, setParentUid] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  /** @module Current storybook reading session */
  const [readingSession, setReadingSession] = useState(null);
  const [readingSaveErrorUid, setReadingSaveErrorUid] = useState(null);
  const selectedModule = readingSession?.story;

  /** @module Child mode follows authentication state and reads the current account's cache */
  useEffect(() => onAuthStateChanged(auth, (user) => {
    const uid = user?.uid || null;
    setParentUid(uid);
    setIsAuthenticated(Boolean(user));
    setAuthChecking(false);
    setReadingSession(null);
    setReadingSaveErrorUid(null);
    setChildStars({});
    const loadedPassports = uid ? loadPassportsFromStorage(uid) : [];
    setModules(uid ? loadModulesFromStorage(uid) : []);
    setPassports(loadedPassports);
    setSelectedPassportId(loadedPassports[0]?.id || "");
  }), []);

  /** @module Child reward loading ignores stale requests after a profile switch */
  useEffect(() => {
    if (!selectedPassportId || !parentUid) return;
    let cancelled = false;
    async function refreshChildStars() {
      try {
        const starsDoc = await getDoc(doc(db, "users", parentUid, "childStars", selectedPassportId));
        if (!cancelled && starsDoc.exists()) {
          setChildStars(prev => ({ ...prev, [selectedPassportId]: starsDoc.data() }));
        }
      } catch (err) {
        console.error("Failed to load stars", err);
      }
    }
    refreshChildStars();
    return () => { cancelled = true; };
  }, [selectedPassportId, parentUid]);

  async function handleStarsCollected(childId, moduleId, stars) {
    if (!parentUid || !childId) return;

    try {
      const starsDocRef = doc(db, "users", parentUid, "childStars", childId);
      const starsDoc = await getDoc(starsDocRef);

      const existingData = starsDoc.exists() ? starsDoc.data() : {};
      const currentTotal = existingData.totalStars || 0;
      const completedModules = existingData.completedModules || {};

      // Only award stars if module hasn't been completed before
      const isNewCompletion = !completedModules[moduleId];
      const starsToAdd = isNewCompletion ? stars : 0;

      const updatedData = {
        totalStars: currentTotal + starsToAdd,
        completedModules: {
          ...completedModules,
          [moduleId]: {
            completedAt: serverTimestamp(),
            starsAwarded: stars,
          },
        },
        lastUpdated: serverTimestamp(),
      };

      await setDoc(starsDocRef, updatedData, { merge: true });

      // Update local state
      setChildStars((prev) => ({
        ...prev,
        [childId]: updatedData,
      }));
    } catch (err) {
      console.error("Failed to save stars", err);
    }
  }

  const selectedPassport =
    passports.find((p) => p.id === (selectedModule?.childId || selectedPassportId)) || null;

  /** @module The child bookshelf shows only storybooks linked to valid profiles */
  const filteredModules = getProfileStories(modules, passports).filter((story) =>
    !selectedPassportId || story.childId === selectedPassportId,
  );

  /** @module Child mode reading sessions and per-page saves */
  function handleOpenStory(story) {
    setReadingSession({ id: crypto.randomUUID(), story });
  }

  function handlePageConfirmed(pageIndex, completed) {
    if (!parentUid || auth.currentUser?.uid !== parentUid || !selectedModule?.childId || !selectedModule.id) return;
    const session = { id: readingSession.id, childId: selectedModule.childId, moduleId: selectedModule.id };
    saveReadingPage(parentUid, session, pageIndex, completed).catch((error) => {
      console.error("Failed to save reading page", error);
      if (auth.currentUser?.uid === parentUid) setReadingSaveErrorUid(parentUid);
    });
  }

  if (authChecking) {
    return <PortalShell><main className="kid-mode" role="status"><p className="lede">{t("Loading…")}</p></main></PortalShell>;
  }

  if (!isAuthenticated) {
    return (
      <PortalShell>
        <main className="kid-mode child-access">
          <h1>{t("Access Restricted")}</h1>
          <p className="lede">{t("The Child Portal requires a parent to be signed in first.")}</p>
          <Link className="primary auto" href="/login">{t("Parent Sign In")}</Link>
          <p className="switch"><Link href="/">{t("Return to Home")}</Link></p>
        </main>
      </PortalShell>
    );
  }

  return (
    <>
      <PortalShell>
        <main className="kid-mode">
          <div className="eyebrow child-eyebrow"><span />{t("STORY TIME")}</div>
          <h1><PortalText text={t('Pick a <em class="accent">story</em>')} /></h1>
          <p className="lede">{t("Tap a story and read it together.")}</p>
          {readingSaveErrorUid === parentUid && (
            <p className="notice error" role="alert">{t("Could not save changes. Please try again.")}</p>
          )}
          <div className="kid-pick" role="group" aria-label={t("Select your profile")}>
            <button type="button" aria-pressed={!selectedPassportId} onClick={() => setSelectedPassportId("")}>{t("Everyone")}</button>
            {passports.map(passport => (
              <button key={passport.id} type="button" aria-pressed={selectedPassportId === passport.id} onClick={() => setSelectedPassportId(passport.id)}>
                {passport.childName}
              </button>
            ))}
          </div>
          {selectedPassportId && (
            <p className="child-stars" role="status"><span aria-hidden="true">★</span> {childStars[selectedPassportId]?.totalStars || 0} {t("stars")}</p>
          )}
          <section className="kid-grid" aria-label={t("Stories")}>
            {!filteredModules.length && <p className="empty-state child-empty">{t("noStoriesYet")}</p>}
            {filteredModules.map(story => {
              const owner = passports.find(passport => passport.id === story.childId);
              return (
                <button className="kid-card" key={story.id} type="button" onClick={() => handleOpenStory(story)}>
                  {story.coverImage ? (
                    <Image className="kid-cover" src={story.coverImage} alt="" width={600} height={300} unoptimized />
                  ) : <PortalIllustration />}
                  <div className="txt">
                    <b>{story.title}</b>
                    <span>{t("For {nickname} · {n} pages", { nickname: owner?.childName || t("Everyone"), n: story.steps?.length || 0 })}</span>
                  </div>
                </button>
              );
            })}
          </section>
          <p className="switch child-back"><Link href="/">{t("Back to the grown-up space")}</Link></p>
        </main>
      </PortalShell>
      {/* Keep the player outside the portal style scope to preserve its modal layout and reward flow. */}
      {selectedModule && (
        <StoryPlayer
          moduleDefinition={selectedModule}
          templateContext={buildContextFromPassport(selectedPassport)}
          narrate={true}
          preferredVoice="female"
          childId={selectedPassport?.id || ""}
          onStarsCollected={handleStarsCollected}
          onPageConfirmed={handlePageConfirmed}
          onClose={() => setReadingSession(null)}
        />
      )}
    </>
  );
}
