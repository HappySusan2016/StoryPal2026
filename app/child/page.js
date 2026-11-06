"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import StoryPlayer from "../components/StoryPlayer";
import { db } from "../lib/firebaseClient";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "../hooks/useTranslation";

const STORAGE_KEY = "storypal.modules";
const PASSPORTS_KEY = "storypal.passports";
const PARENT_UID_KEY = "storypal.parent.uid";

function loadModulesFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadPassportsFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PASSPORTS_KEY);
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
  const [selectedModule, setSelectedModule] = useState(null);
  const [passports, setPassports] = useState([]);
  const [selectedPassportId, setSelectedPassportId] = useState("");
  const [childStars, setChildStars] = useState({});
  const [parentUid, setParentUid] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    // Check authentication first
    if (typeof window !== "undefined") {
      const uid = window.localStorage.getItem(PARENT_UID_KEY);
      if (!uid) {
        setIsAuthenticated(false);
        setAuthChecking(false);
        return;
      }
      setParentUid(uid);
      setIsAuthenticated(true);
    }
    setAuthChecking(false);

    // Only load data if authenticated
    if (isAuthenticated) {
      setModules(loadModulesFromStorage());
      const loadedPassports = loadPassportsFromStorage();
      setPassports(loadedPassports);
      // Auto-select first child if any passports exist
      if (loadedPassports.length > 0) {
        setSelectedPassportId(loadedPassports[0].id);
      }
    }
  }, [isAuthenticated]);

  // Load stars when passport is selected
  useEffect(() => {
    if (selectedPassportId && parentUid) {
      loadStarsForChild(selectedPassportId);
    }
  }, [selectedPassportId, parentUid]);

  async function loadStarsForChild(childId) {
    if (!parentUid || !childId) return;

    try {
      const starsDoc = await getDoc(
        doc(db, "users", parentUid, "childStars", childId)
      );
      if (starsDoc.exists()) {
        setChildStars((prev) => ({
          ...prev,
          [childId]: starsDoc.data(),
        }));
      }
    } catch (err) {
      console.error("Failed to load stars", err);
    }
  }

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
    passports.find((p) => p.id === selectedPassportId) || null;

  // Filter modules to show only those for the selected passport or general modules
  const filteredModules = modules.filter((m) => {
    // Show general modules (childId is null or empty)
    if (!m.childId) return true;
    // If a passport is selected, show modules for that child
    if (selectedPassportId && m.childId === selectedPassportId) return true;
    // Otherwise, don't show this module
    return false;
  });

  // Show loading while checking auth
  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <p className="text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth gate if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-8xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-4">
            Access Restricted
          </h1>
          <p className="text-lg text-zinc-700 mb-8">
            The Child Portal requires a parent to be signed in first.
          </p>
          <Link
            href="/parent/auth"
            className="inline-block px-8 py-3 bg-[#5b217f] text-white rounded-xl font-semibold hover:bg-[#7c2da3] transition-colors shadow-lg"
          >
            Parent Sign In
          </Link>
          <div className="mt-6">
            <Link
              href="/"
              className="text-sm text-zinc-600 hover:text-zinc-900 underline"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-semibold text-zinc-900">{t("childPortal")}</h1>
        </div>
        <p className="mt-2 text-zinc-700">{t("selectYourPassport")}</p>

        <div className="mt-4 rounded-2xl bg-white/80 backdrop-blur p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-zinc-700">
                Select your profile
              </label>
              <select
                value={selectedPassportId}
                onChange={(e) => setSelectedPassportId(e.target.value)}
                className="bg-white/90 border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
              >
                <option value="">— None —</option>
                {passports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.childName}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">
                Passports are created in the Parent Portal.
              </span>
            </div>

            {/* Stars Display */}
            {selectedPassportId && (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-200 rounded-xl ">
                <span className="text-lg text-yellow-500">
                  <FontAwesomeIcon icon={faStar} />
                </span>
                <div className="text-left">
                  <div className="text-lg font-bold text-amber-900">
                    {childStars[selectedPassportId]?.totalStars || 0} {t("stars")}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.length === 0 && (
            <div className="text-zinc-600">
              {t("noStoriesYet")}
            </div>
          )}
          {filteredModules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModule(m)}
              className="text-left rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/80 backdrop-blur"
            >
              <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden mb-3 bg-zinc-100">
                {m.coverImage ? (
                  <Image
                    src={m.coverImage}
                    alt={m.title}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    No image
                  </div>
                )}
              </div>
              <div className="text-zinc-900 font-semibold leading-snug">
                {m.title}
              </div>
            </button>
          ))}
        </section>
      </div>

      {selectedModule && (
        <StoryPlayer
          moduleDefinition={selectedModule}
          templateContext={buildContextFromPassport(selectedPassport)}
          narrate={true}
          preferredVoice="female"
          childId={selectedPassportId}
          onStarsCollected={handleStarsCollected}
          onClose={() => setSelectedModule(null)}
          onFinished={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}
