"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebaseClient";
import { useTranslation } from "../hooks/useTranslation";
import "../portal.css";

/** @module Legacy font preference compatibility */
function subscribeFont(onChange) {
  window.addEventListener("fontchange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("fontchange", onChange);
    window.removeEventListener("storage", onChange);
  };
}
function getFont() {
  return localStorage.getItem("sp.uiFont") || "classic";
}

/** @module Shared portal navigation */
export default function PortalShell({ children }) {
  const { t, language } = useTranslation();
  const pathname = usePathname();
  const font = useSyncExternalStore(subscribeFont, getFont, () => "classic");
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return (
    <div
      className="portal"
      data-font={
        { classic: "epilogue", hand: "shadows", playful: "slackey" }[font] ||
        "epilogue"
      }
    >
      {(language === "zh" || language === "bn") && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${language === "zh" ? "Noto+Sans+SC" : "Noto+Sans+Bengali"}:wght@400;600;700&display=swap`}
        />
      )}
      <div className="page-shell">
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-mark">✳</span>
            <span>StoryPal</span>
          </Link>
          <nav className="nav" aria-label={t("Navigation")}>
            {(user
              ? [
                  ["/", "My space"],
                  ["/child", "Child mode"],
                  ["/settings", "Settings"],
                ]
              : [
                  ["/login", "Sign in"],
                  ["/signup", "Create account"],
                ]
            ).map(([href, label]) => (
              <Link
                key={href}
                data-telemetry={`nav_${href === "/" ? "home" : href.slice(1)}`}
                href={href}
                aria-current={
                  pathname === href ||
                  (href === "/" && pathname.startsWith("/profiles/"))
                    ? "page"
                    : undefined
                }
                className={href === "/signup" ? "nav-cta" : ""}
              >
                {t(label)}
              </Link>
            ))}
            {user && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  await signOut(auth);
                  window.location.assign("/login");
                }}
              >
                <button type="submit">{t("Sign out")}</button>
              </form>
            )}
          </nav>
        </header>
        {children}
        <footer>
          <span>
            {t(
              "Made for the grown-ups who help little hearts feel understood.",
            )}
          </span>
          <Link href="/privacy">{t("Privacy note")}</Link>
          <Link href="/terms">{t("Terms")}</Link>
        </footer>
      </div>
    </div>
  );
}
