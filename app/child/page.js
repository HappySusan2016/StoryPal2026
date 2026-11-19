"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PortalShell from "../components/PortalShell";
import PortalText from "../components/PortalText";
import PortalIllustration from "../components/PortalIllustration";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import { getProfileStories } from "../lib/portalData";
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

export default function ChildPortal() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  const [passports, setPassports] = useState([]);
  const [selectedPassportId, setSelectedPassportId] = useState("");
  const [childStars, setChildStars] = useState({});
  const [parentUid, setParentUid] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  /** @module Child mode follows authentication state and reads the current account's cache */
  useEffect(() => onAuthStateChanged(auth, (user) => {
    const uid = user?.uid || null;
    setParentUid(uid);
    setIsAuthenticated(Boolean(user));
    setAuthChecking(false);
    setChildStars({});
    const loadedPassports = uid ? loadPassportsFromStorage(uid) : [];
    setModules(uid ? loadModulesFromStorage(uid) : []);
    setPassports(loadedPassports);
    // Restore the previous profile filter when returning to the bookshelf.
    const profile = new URLSearchParams(window.location.search).get("profile");
    setSelectedPassportId(profile === "" || loadedPassports.some((passport) => passport.id === profile)
      ? profile
      : loadedPassports[0]?.id || "");
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

  /** @module The child bookshelf shows only storybooks linked to valid profiles */
  const filteredModules = getProfileStories(modules, passports).filter((story) =>
    !selectedPassportId || story.childId === selectedPassportId,
  );

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
    <PortalShell>
      <main className="kid-mode">
        <div className="eyebrow child-eyebrow"><span />{t("STORY TIME")}</div>
        <h1><PortalText text={t('Pick a <em class="accent">story</em>')} /></h1>
        <p className="lede">{t("Tap a story and read it together.")}</p>
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
              <Link className="kid-card" key={story.id} href={`/stories/${encodeURIComponent(story.id)}?mode=child&profile=${encodeURIComponent(selectedPassportId)}`}>
                {story.coverImage ? (
                  <Image className="kid-cover" src={story.coverImage} alt="" width={600} height={300} unoptimized />
                ) : <PortalIllustration />}
                <div className="txt">
                  <b>{story.title}</b>
                  <span>{t("For {nickname} · {n} pages", { nickname: owner?.childName || t("Everyone"), n: story.steps?.length || 0 })}</span>
                </div>
              </Link>
            );
          })}
        </section>
        <p className="switch child-back"><Link href="/">{t("Back to the grown-up space")}</Link></p>
      </main>
    </PortalShell>
  );
}
