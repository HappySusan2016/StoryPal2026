"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebaseClient";
import PortalShell from "../components/PortalShell";
import PortalText from "../components/PortalText";
import { translations } from "../lib/translations";
import { useTranslation } from "../hooks/useTranslation";

/** @module Account and display preferences */
export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [font, setFont] = useState("classic");
  const [language, setLanguage] = useState("en");
  const [textSize, setTextSize] = useState("normal");
  useEffect(() => {
    return onAuthStateChanged(auth, (value) => {
      setUser(value);
      setReady(true);
      setFont(localStorage.getItem("sp.uiFont") || "classic");
      setLanguage(localStorage.getItem("sp.siteLanguage") || "en");
      setTextSize(localStorage.getItem("sp.storyTextSize") || "normal");
      if (!value) router.replace("/login");
    });
  }, [router]);
  async function handleAction(action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(t("Saved."));
    } catch (err) {
      setError(
        t(
          err.code === "auth/wrong-password" ||
            err.code === "auth/invalid-credential"
            ? "Current password is incorrect."
            : "Could not save changes. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function handlePreference(event, key, value, eventName) {
    event.preventDefault();
    localStorage.setItem(key, value);
    if (eventName)
      window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
    setMessage(t("Applied"));
  }
  /** @module Sign-out and local cache cleanup */
  async function handleExit(clearCache = false) {
    await signOut(auth);
    if (clearCache) {
      for (const storage of [localStorage, sessionStorage]) {
        Object.keys(storage)
          .filter((key) => key.startsWith("storypal.") || key.startsWith("sp."))
          .forEach((key) => storage.removeItem(key));
      }
      document.documentElement.setAttribute("data-ui-font", "classic");
      document.documentElement.lang = "en";
      window.dispatchEvent(new CustomEvent("storytextchange"));
      window.dispatchEvent(
        new CustomEvent("fontchange", { detail: "classic" }),
      );
      window.dispatchEvent(new CustomEvent("languagechange", { detail: "en" }));
    }
    router.replace("/login");
  }
  /** @module Reference preference options and preview */
  function renderChoices(name, value, options, setter) {
    const fontNames = {
      classic: "epilogue",
      hand: "shadows",
      playful: "slackey",
    };
    return (
      <div className="choices">
        {options.map(([key, label, description]) => (
          <label
            className={name === "font" ? "choice font-choice" : "choice"}
            data-font={name === "font" ? fontNames[key] : undefined}
            key={key}
          >
            <input
              type="radio"
              name={name}
              value={name === "font" ? fontNames[key] : key}
              checked={value === key}
              onChange={() => setter(key)}
            />
            <span>
              {name === "font" ? (
                <>
                  <b>{label}</b> <small>({t(description)})</small>
                </>
              ) : name === "lang" ? (
                `${label} (${description})`
              ) : (
                t(label)
              )}
            </span>
          </label>
        ))}
      </div>
    );
  }
  function translatePreview(key) {
    return translations[language]?.[key] || translations.en[key] || key;
  }
  return (
    <PortalShell>
      <main className="workspace">
        <div className="eyebrow">
          <span />
          {t("SETTINGS")}
        </div>
        <h1>
          <PortalText text={t('Your <em class="accent">settings</em>')} />
        </h1>
        <p className="lede">
          {t(
            "Your account, display preferences, and the controls for your family's data.",
          )}
        </p>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {!ready || !user ? (
          <p role="status">{t("Loading…")}</p>
        ) : (
          <section className="account-grid">
            <div className="card">
              <div className="section-label">{t("ABOUT YOU")}</div>
              <h2>{t("Account details")}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = new FormData(e.currentTarget).get("name").trim();
                  handleAction(() =>
                    updateProfile(user, { displayName: name }),
                  );
                }}
              >
                <label htmlFor="settings-name">{t("Your name")}</label>
                <input
                  id="settings-name"
                  name="name"
                  maxLength={80}
                  defaultValue={user.displayName || ""}
                  required
                />
                <label htmlFor="settings-email">{t("Email address")}</label>
                <input
                  id="settings-email"
                  type="email"
                  value={user.email || ""}
                  disabled
                />
                <p className="hint" style={{ marginTop: 6 }}>
                  {t("Email is used only to sign in.")} {t("Member since")}{" "}
                  {user.metadata.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString(
                        language,
                      )
                    : ""}
                </p>
                <button className="primary auto" disabled={busy}>
                  {t("Save name")} <span>→</span>
                </button>
              </form>
            </div>
            <div className="card">
              <div className="section-label">{t("READING")}</div>
              <h2>{t("Text size in stories")}</h2>
              <p>
                {t(
                  "Larger text helps early readers follow along as you read aloud.",
                )}
              </p>
              <form
                onSubmit={(e) =>
                  handlePreference(
                    e,
                    "sp.storyTextSize",
                    textSize,
                    "storytextchange",
                  )
                }
              >
                {renderChoices(
                  "size",
                  textSize,
                  [
                    ["normal", "Normal"],
                    ["large", "Large"],
                    ["xl", "Extra large"],
                  ],
                  setTextSize,
                )}
                <button className="primary auto">
                  {t("Apply")} <span>→</span>
                </button>
              </form>
            </div>
            <div className="card pref-card font-card">
              <div className="section-label">{t("APPEARANCE")}</div>
              <h2>{t("Site font")}</h2>
              <p>
                {t(
                  "Choose the lettering used across StoryPal, including stories.",
                )}
              </p>
              <form
                onSubmit={(e) =>
                  handlePreference(e, "sp.uiFont", font, "fontchange")
                }
              >
                {renderChoices(
                  "font",
                  font,
                  [
                    ["classic", "Epilogue", "Classic"],
                    ["hand", "Shadows Into Light", "Handwritten"],
                    ["playful", "Slackey", "Playful"],
                  ],
                  setFont,
                )}
                <div className="preview-box">
                  <span className="preview-label">{t("Preview")}</span>
                  <p className="sample-title">{t("A New Day at School")}</p>
                  <p>
                    {t(
                      "“I can feel a little wobbly and still take one small step. My grown-up will be there when the day is done.”",
                    )}
                  </p>
                </div>
                <button className="primary auto">
                  {t("Apply font")} <span>→</span>
                </button>
              </form>
            </div>
            <div className="card pref-card lang-card">
              <div className="section-label">{t("LANGUAGE")}</div>
              <h2>{t("Site language")}</h2>
              <p>
                {t(
                  "Menus, pages and new stories appear in this language. Stories you already made keep their words.",
                )}
              </p>
              <form
                onSubmit={(e) =>
                  handlePreference(
                    e,
                    "sp.siteLanguage",
                    language,
                    "languagechange",
                  )
                }
              >
                {renderChoices(
                  "lang",
                  language,
                  [
                    ["en", "English", "English"],
                    ["es", "Spanish", "Español"],
                    ["pt", "Portuguese", "Português"],
                    ["bn", "Bengali", "বাংলা"],
                    ["zh", "Chinese", "中文"],
                  ],
                  setLanguage,
                )}
                <div
                  className="preview-box"
                  lang={language === "zh" ? "zh-Hans" : language}
                >
                  <span className="preview-label">{t("Preview")}</span>
                  <div className="sample-nav">
                    {["My space", "Child mode", "Settings"].map((label) => (
                      <span key={label}>{translatePreview(label)}</span>
                    ))}
                  </div>
                  <p className="sample-title">
                    {translatePreview("Story time")} ·{" "}
                    {
                      {
                        en: "English",
                        es: "Español",
                        pt: "Português",
                        bn: "বাংলা",
                        zh: "中文",
                      }[language]
                    }
                  </p>
                  <p>
                    {translatePreview(
                      "Create a safe space to talk about feelings, practice new routines, and imagine what comes next — one little story at a time.",
                    )}
                  </p>
                </div>
                <button className="primary auto">
                  {t("Apply language")} <span>→</span>
                </button>
              </form>
            </div>
            <div className="card">
              <div className="section-label">{t("PASSWORD")}</div>
              <h2>{t("Change password")}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  handleAction(async () => {
                    await reauthenticateWithCredential(
                      user,
                      EmailAuthProvider.credential(
                        user.email,
                        data.get("current"),
                      ),
                    );
                    await updatePassword(user, data.get("new"));
                    form.reset();
                  });
                }}
              >
                <label htmlFor="current">{t("Current password")}</label>
                <input
                  id="current"
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <label htmlFor="new">{t("New password")}</label>
                <input
                  id="new"
                  name="new"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
                <p className="hint" style={{ marginTop: 6 }}>
                  {t("10 characters or more.")}
                </p>
                <button className="primary auto" disabled={busy}>
                  {t("Update password")} <span>→</span>
                </button>
              </form>
            </div>
            <div className="card">
              <div className="section-label">{t("SESSIONS")}</div>
              <h2>{t("Signed-in devices")}</h2>
              <p>
                <PortalText
                  text={t(
                    "You are signed in on <b>$n_sessions</b> device(s). Signing out everywhere ends every session, including this one.",
                    { n_sessions: 1 },
                  )}
                />
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => handleAction(() => handleExit())}
              >
                {t("Sign out everywhere")}
              </button>
            </div>
            <div className="card danger-zone">
              <div className="section-label">{t("DELETE ACCOUNT")}</div>
              <h2>{t("Delete everything")}</h2>
              <p>
                {t(
                  "Removes your account, every child profile, passport notes and story from this computer's database. It cannot be undone.",
                )}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAction(() => handleExit(true));
                }}
              >
                <label htmlFor="delete-password">
                  {t("Confirm your password")}
                </label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <label className="check">
                  <input type="checkbox" required />
                  <span>
                    {t("I understand this deletes all data permanently.")}
                  </span>
                </label>
                <button className="secondary danger" disabled={busy}>
                  {t("Delete my account")}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </PortalShell>
  );
}
