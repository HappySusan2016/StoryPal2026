"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import StoryPlayer from "../components/StoryPlayer";
import SavedModules from "../components/SavedModules";
import ReflectionJournal from "../components/ReflectionJournal";
import CommunicationPassports from "../components/CommunicationPassports";
import StoryModules from "../components/StoryModules";
import { useTranslation } from "../hooks/useTranslation";
import { auth, db } from "../lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPassport } from "@fortawesome/free-solid-svg-icons";

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
  // Save to user-specific key
  window.localStorage.setItem(
    scopedKey(STORAGE_KEY, uid),
    JSON.stringify(modules)
  );
  // Also save to global key for child portal access
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
  // Save to user-specific key
  window.localStorage.setItem(
    scopedKey(PASSPORTS_KEY, uid),
    JSON.stringify(passports)
  );
  // Also save to global key for child portal access
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
    JSON.stringify(reflections)
  );
}

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

// Simple pregenerated example story modules shown by default
const DEFAULT_MODULES = [
  {
    id: "demo-green-mission",
    title: "The Green Mission",
    // Use a bundled image (from /public) so it works offline and doesn't depend on external URLs
    coverImage: "/green.jpg",
    fontPreset: "classic",
    childId: null,
    stageDesign: null,
    steps: [
      {
        type: "doctor",
        message:
          "Welcome to The Green Mission! Today, we're going on an adventure to help our friend the frog find its way home.",
        parentGuide: {
          title: "Story Introduction",
          description: "Set a playful, low-pressure tone.",
          coActionPrompt:
            "Practice: 'We're going to help the frog together. It's just for fun!'",
        },
      },
      {
        type: "doctor",
        message:
          "The friendly frog lives in a beautiful pond surrounded by lily pads and colorful fish. Can you imagine the pond in your mind?",
        parentGuide: {
          title: "Visualization",
          description: "Support imagination at their pace.",
          coActionPrompt:
            "Practice: 'What colors do you see? Can you draw it later?'",
        },
      },
      {
        type: "choice",
        message: "What do you think the frog needs help with?",
        options: [
          "Finding lily pads to hop on",
          "Making friends with other pond creatures",
          "Learning to swim in deeper water",
        ],
        parentGuide: {
          title: "Problem-Solving",
          description: "Encourage thinking without pressure.",
          coActionPrompt:
            "Practice: 'What do you think? All answers help the frog!'",
        },
      },
      {
        type: "user-input",
        message:
          "Let's help the frog! What would you say to encourage the frog on its journey?",
        placeholder:
          "e.g., You can do it, little frog! Take one hop at a time.",
        parentGuide: {
          title: "Encouragement Practice",
          description: "Model positive self-talk.",
          coActionPrompt:
            "Practice: 'When you encourage the frog, you're practicing encouraging yourself too!'",
        },
      },
      {
        type: "doctor",
        message:
          "Great job! The frog made it home safely thanks to your help. Remember, taking small steps is how we accomplish big things!",
        parentGuide: {
          title: "Celebration",
          description: "Reinforce the lesson learned.",
          coActionPrompt:
            "Practice: 'You helped the frog! What small step can you take today?'",
        },
      },
    ],
  },
  {
    id: "demo-calm-breathing",
    title: "Calm Breathing Mission",
    coverImage: "/calm.jpg",
    fontPreset: "classic",
    childId: null,
    stageDesign: null,
    steps: [
      {
        type: "doctor",
        message:
          "Hi {{child.name}}! Today our mission is to help your body feel calmer with three sparkle breaths.",
        parentGuide: {
          title: "Sensory Check",
          description: "Prepare for sensory input.",
          coActionPrompt: "Practice: 'If it's loud, I can wear headphones.'",
        },
      },
      {
        type: "doctor",
        message:
          "First, put one hand on your chest and one hand on your tummy. Feel them move as you breathe in and out.",
        parentGuide: {
          title: "Body Awareness",
          description: "Help your child connect with their body.",
          coActionPrompt:
            "Practice: Place your hands on your own chest and belly. Do it together and make it playful.",
        },
      },
      {
        type: "choice",
        message: "How does your body feel right now?",
        options: ["A little wiggly", "Very wiggly", "Pretty calm"],
        parentGuide: {
          title: "Emotional Check-in",
          description: "Validate all feelings as acceptable.",
          coActionPrompt:
            "Practice: 'There's no wrong answer. How does YOUR body feel right now?'",
        },
      },
      {
        type: "doctor",
        message:
          "Let's try three slow sparkle breaths together. Breathe in through your nose… and blow the sparkles out gently.",
        parentGuide: {
          title: "Co-Regulation",
          description: "Breathe together to calm the nervous system.",
          coActionPrompt:
            "Practice: Do the breathing WITH them. Your calm helps their calm.",
        },
      },
    ],
  },
  {
    id: "demo-school-wave",
    title: "Brave School Wave",
    coverImage: "/brave.jpg",
    fontPreset: "classic",
    childId: null,
    stageDesign: null,
    steps: [
      {
        type: "doctor",
        message:
          "StoryPal time! Today we practice a brave wave for when you arrive at school.",
        parentGuide: {
          title: "Social Preparation",
          description: "Practice greetings in a safe space.",
          coActionPrompt:
            "Practice: 'We can practice waving right now. Want to wave to me?'",
        },
      },
      {
        type: "doctor",
        message:
          "Imagine you are standing by the classroom door. Your teacher smiles and says your name.",
        parentGuide: {
          title: "Scenario Building",
          description: "Make the scenario feel safe and familiar.",
          coActionPrompt:
            "Practice: 'Let's pretend I'm the teacher. [Child's name], good morning!'",
        },
      },
      {
        type: "choice",
        message: "What feels like a good first step?",
        options: [
          "A tiny wave with your hand",
          "Just looking and nodding",
          "Holding your grown‑up's hand and waving together",
        ],
        parentGuide: {
          title: "Choice & Autonomy",
          description: "Honor their comfort level.",
          coActionPrompt:
            "Practice: 'Each option is brave in its own way. What feels right for you?'",
        },
      },
      {
        type: "user-input",
        message:
          "Together, choose one brave micro‑step for tomorrow morning. Type it here as your mission.",
        placeholder:
          "e.g., I will look at the teacher and lift my hand a little.",
        parentGuide: {
          title: "Goal Setting",
          description: "Create a tiny, achievable goal together.",
          coActionPrompt:
            "Practice: 'What's the smallest, easiest step we can try? That's our mission!'",
        },
      },
    ],
  },
];

// Static interactive training module for parents
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

export default function ParentPortal() {
  const router = useRouter();
  const { t } = useTranslation();
  const savedModulesRef = useRef(null);
  const [modules, setModules] = useState([]);
  const [passports, setPassports] = useState([]);
  const [selectedPassportId, setSelectedPassportId] = useState(null);
  // Reflection Journal state
  const [reflections, setReflections] = useState([]);
  // Story module editing state
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [showStoryBuilder, setShowStoryBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewModule, setPreviewModule] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [showPassportDropdown, setShowPassportDropdown] = useState(false);

  // Require authenticated parent
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthReady(false);
        setAuthChecking(false);
        setCurrentUser(null);
        // Clear parent UID from localStorage
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("storypal.parent.uid");
        }
        router.replace("/parent/auth");
        return;
      }
      setCurrentUser(user);
      setAuthReady(true);
      setAuthChecking(false);
      // Save parent UID to localStorage for child portal
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
      const uid = currentUser.uid;
      try {
        const snap = await getDocs(collection(db, "users", uid, "modules"));
        const cloudModules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Ensure demo modules are present at least once
        const missingDefaults = DEFAULT_MODULES.filter(
          (demo) => !cloudModules.some((m) => m.id === demo.id)
        );

        if (missingDefaults.length > 0) {
          await Promise.all(
            missingDefaults.map((demo) =>
              setDoc(
                doc(db, "users", uid, "modules", demo.id),
                {
                  ...demo,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              )
            )
          );
        }

        // Migrate existing demo modules away from external image URLs
        const demoById = new Map(DEFAULT_MODULES.map((m) => [m.id, m]));
        const modulesNeedingCoverMigration = cloudModules.filter((m) => {
          const demo = demoById.get(m.id);
          if (!demo) return false;
          return typeof m.coverImage === "string" && m.coverImage.startsWith("http");
        });

        if (modulesNeedingCoverMigration.length > 0) {
          await Promise.all(
            modulesNeedingCoverMigration.map((m) => {
              const demo = demoById.get(m.id);
              return setDoc(
                doc(db, "users", uid, "modules", m.id),
                { coverImage: demo.coverImage, updatedAt: serverTimestamp() },
                { merge: true }
              );
            })
          );
        }

        const migratedCloudModules =
          modulesNeedingCoverMigration.length > 0
            ? cloudModules.map((m) => {
                const demo = demoById.get(m.id);
                if (
                  demo &&
                  typeof m.coverImage === "string" &&
                  m.coverImage.startsWith("http")
                ) {
                  return { ...m, coverImage: demo.coverImage };
                }
                return m;
              })
            : cloudModules;

        const mergedModules =
          missingDefaults.length > 0
            ? [...migratedCloudModules, ...missingDefaults]
            : migratedCloudModules;

        if (!cancelled) {
          setModules(mergedModules);
          saveModulesToStorage(mergedModules, uid);
        }
      } catch (err) {
        console.error("Failed to load modules from Firestore", err);
      } finally {
        if (!cancelled) setModulesLoading(false);
      }

      // Load passports from Firestore
      try {
        const passportSnap = await getDocs(
          collection(db, "users", uid, "passports")
        );
        const cloudPassports = passportSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        if (!cancelled) {
          setPassports(cloudPassports);
          savePassportsToStorage(cloudPassports, uid);
          if (cloudPassports.length > 0) {
            setSelectedPassportId(cloudPassports[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load passports from Firestore", err);
        // Fallback to localStorage
        const loadedPassports = loadPassportsFromStorage(uid);
        if (!cancelled) {
          setPassports(loadedPassports);
          if (loadedPassports.length > 0) {
            setSelectedPassportId(loadedPassports[0].id);
          }
        }
      }

      if (!cancelled) {
        setReflections(loadReflectionsFromStorage(uid));
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser]);

  const showAuthGate = authChecking || !authReady;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/parent/auth");
    } catch (err) {
      console.error("Failed to sign out", err);
    }
  };

  useEffect(() => {
    function handleLogoutRequest() {
      handleSignOut();
    }
    window.addEventListener("request-logout", handleLogoutRequest);
    return () => {
      window.removeEventListener("request-logout", handleLogoutRequest);
    };
  }, []);

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

  const selectedPassport = useMemo(
    () => passports.find((p) => p.id === selectedPassportId) || null,
    [passports, selectedPassportId]
  );

  async function deleteModule(id) {
    const next = modules.filter((m) => m.id !== id);
    setModules(next);
    saveModulesToStorage(next, currentUser?.uid);
    if (currentUser?.uid) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "modules", id));
      } catch (err) {
        console.error("Failed to delete module from Firestore", err);
      }
    }
    if (editingModuleId === id) {
      setEditingModuleId(null);
      setShowStoryBuilder(false);
    }
  }

  async function handleModuleSave(moduleDefinition) {
    const uid = currentUser?.uid;
    const moduleWithMeta = {
      ...moduleDefinition,
      createdAt: moduleDefinition.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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

    // Scroll to saved modules section
    setTimeout(() => {
      if (savedModulesRef.current) {
        savedModulesRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);

    if (uid) {
      try {
        await setDoc(
          doc(db, "users", uid, "modules", moduleWithMeta.id),
          {
            ...moduleWithMeta,
            updatedAt: serverTimestamp(),
            createdAt: moduleWithMeta.createdAt,
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to save module to Firestore", err);
      }
    }
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
    setShowStoryBuilder(false);
    setEditingModuleId(null);
  }

  // When the modal is open, prevent the background page from scrolling.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!showStoryBuilder) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showStoryBuilder]);

  if (showAuthGate) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-rose-50 via-white to-blue-50">
        <div className="text-center space-y-2">
          <div className="text-lg font-semibold text-zinc-800">
            Checking parent sign-in…
          </div>
          <div className="text-sm text-zinc-600">
            If this takes long, please sign in again.
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="relative">
          <div className="flex items-center gap-3 justify-between">
            <h1 className="text-4xl font-semibold text-zinc-900">
              {t("parentPortal")}
            </h1>
            <button
              type="button"
              onClick={() => setShowPassportDropdown(!showPassportDropdown)}
              data-telemetry="parent_passport_dropdown_toggle"
              className="rounded-xl px-2 py-2 flex items-center justify-center  bg-slate-200 text-[#5b217f] hover:bg-slate-300 transition-colors"
              title={t("communicationPassports")}
              aria-label={t("communicationPassports")}
            >
              <p className="text-sm font-semibold">
                {selectedPassport?.avatar ? (
                  <img
                    src={
                      selectedPassport.avatar === "elephant"
                        ? "/elephant.png"
                        : selectedPassport.avatar === "giraffe"
                        ? "/jiraffe.png"
                        : "/bird.png"
                    }
                    alt={selectedPassport.avatar}
                    className="inline-block w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <FontAwesomeIcon icon={faPassport} />
                )}
                {"    "}
                {selectedPassport?.childName}
              </p>
            </button>
          </div>
        </div>

        {showPassportDropdown && (
          <CommunicationPassports
            passports={passports}
            selectedPassportId={selectedPassportId}
            onPassportChange={async (next) => {
              const uid = currentUser?.uid;
              setPassports(next);
              savePassportsToStorage(next, uid);

              // Save all passports to Firestore
              if (uid) {
                try {
                  await Promise.all(
                    next.map((passport) =>
                      setDoc(
                        doc(db, "users", uid, "passports", passport.id),
                        {
                          ...passport,
                          updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                      )
                    )
                  );
                } catch (err) {
                  console.error("Failed to save passports to Firestore", err);
                }
              }
            }}
            onSelectedPassportChange={setSelectedPassportId}
          />
        )}

        {/* Interactive Parent Training – always available */}
        <section className="mt-6 rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            {t("interactiveParentTraining")}
          </h2>
          <p className="mt-2 text-sm text-zinc-700">
            {t("trainingDescription")}{" "}
            <span className="font-semibold">{t("coAction")}</span> {t("trainingDescription2")}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPreviewModule(PARENT_TRAINING_MODULE);
                setShowPreview(true);
              }}
              data-telemetry="parent_training_start"
              className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3] text-sm font-semibold"
            >
              {t("startTraining")}
            </button>
            <span className="text-xs text-zinc-500">
              {t("minutesRead")}
            </span>
          </div>
        </section>

        {/* Saved Modules */}
        <div ref={savedModulesRef}>
          <SavedModules
            modules={modules}
            onCreate={openCreateStory}
            canCreate={passports.length > 0}
            createDisabledReason={
              passports.length > 0
                ? ""
                : "Create a Communication Passport first to start building stories."
            }
            onEdit={(m) => {
              if (m.childId) setSelectedPassportId(m.childId);
              handleModuleEdit(m);
            }}
            onDelete={deleteModule}
          />
        </div>

        {passports.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center min-h-[40vh]">
            <div className="text-center max-w-md">
              <h2 className="text-3xl font-semibold text-zinc-900 mb-4">
                {t("createPassportToContinue")}
              </h2>
              <p className="text-lg text-zinc-700 mb-6">
                {t("createPassportDescription")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Reflection Journal */}
            <ReflectionJournal
              modules={modules}
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
                  (r) => r.id === reflection.id
                );
                if (existingIdx >= 0) {
                  next[existingIdx] = reflection;
                } else {
                  next.push(reflection);
                }
                setReflections(next);
                saveReflectionsToStorage(next, currentUser?.uid);
              }}
              onEdit={(reflection) => {
                // Component handles this internally
              }}
              onDelete={(id) => {
                const next = reflections.filter((r) => r.id !== id);
                setReflections(next);
                saveReflectionsToStorage(next, currentUser?.uid);
              }}
            />
          </>
        )}

        {/* Removed duplicate passport form - handled by CommunicationPassports component */}
        {false && (
          <div className="mt-6 rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">
                New Passport
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPassportForm(false);
                  resetPassportForm();
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
                <div className="mt-2 grid grid-cols-3 gap-3 ">
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
                      setCpPronouns({
                        ...cpPronouns,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Subject (they)"
                    className="bg-white/90 border border-zinc-200 rounded-xl px-3 py-2"
                  />
                  <input
                    value={cpPronouns.object}
                    onChange={(e) =>
                      setCpPronouns({
                        ...cpPronouns,
                        object: e.target.value,
                      })
                    }
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
                    setCpSensory({
                      ...cpSensory,
                      strategies: e.target.value,
                    })
                  }
                  rows={2}
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
                  className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-2"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={upsertPassport}
                disabled={!cpName.trim()}
                className="rounded-xl px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                Save Passport
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPassportForm(false);
                  resetPassportForm();
                }}
                className="rounded-xl px-4 py-2 bg-zinc-100 hover:bg-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>

      {showStoryBuilder && passports.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeStoryBuilder}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white/95 backdrop-blur border border-zinc-200 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white/90 backdrop-blur">
              <div>
                <div className="text-xl font-semibold text-zinc-900">
                  {editingModuleId ? "Edit story" : "Create story"}
                </div>
                <div className="text-sm text-zinc-600">
                  Build and preview stories, then save to your account.
                </div>
              </div>
              <button
                type="button"
                onClick={closeStoryBuilder}
                data-telemetry="parent_story_builder_close"
                className="rounded-xl px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
              >
                {t("close")}
              </button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <StoryModules
                passports={passports}
                onSave={handleModuleSave}
                onPreview={handleModulePreview}
                initialData={
                  editingModuleId
                    ? modules.find((m) => m.id === editingModuleId)
                    : null
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
    </div>
  );
}
