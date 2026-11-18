"use client";

import Link from "next/link";
import PortalIllustration from "./PortalIllustration";
import PortalText from "./PortalText";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebaseClient";
import { useTranslation } from "../hooks/useTranslation";

/** @module Email sign-up and sign-in */
export default function PortalAuth({ signup = false, onSignedIn }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setError("");
  }, [signup]);
  async function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      if (signup) {
        const result = await createUserWithEmailAndPassword(
          auth,
          data.get("email"),
          data.get("password"),
        );
        await updateProfile(result.user, {
          displayName: data.get("name").trim(),
        });
      } else
        await signInWithEmailAndPassword(
          auth,
          data.get("email"),
          data.get("password"),
        );
      onSignedIn?.();
      router.replace("/");
    } catch (err) {
      setError(
        t(
          {
            "auth/invalid-credential": "Email or password is incorrect.",
            "auth/email-already-in-use": "This email is already registered.",
            "auth/weak-password": "Use 10 characters or more.",
            "auth/network-request-failed":
              "Network unavailable. Please try again.",
          }[err.code] || "Unable to sign in. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="form-panel">
      <div className="form-heading">
        <span className="step">
          {t(signup ? "YOUR STORYPAL SPACE" : "WELCOME BACK")}
        </span>
        <h2>{t(signup ? "Let's get started" : "Your stories are waiting")}</h2>
        <p>
          {t(
            signup
              ? "Make an account for you and your family."
              : "Sign in to your StoryPal space.",
          )}
        </p>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        {signup && (
          <>
            <label htmlFor="auth-name">{t("Your name")}</label>
            <input
              id="auth-name"
              name="name"
              autoComplete="name"
              placeholder={t("e.g. Jamie Rivera")}
              maxLength={80}
              required
            />
          </>
        )}
        <label htmlFor="auth-email">{t("Email address")}</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={signup ? "you@example.com" : undefined}
          maxLength={254}
          required
        />
        <label htmlFor="auth-password">
          {t(signup ? "Create a password" : "Password")}
        </label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 10 : undefined}
          placeholder={signup ? t("At least 10 characters") : undefined}
          required
        />
        {signup && (
          <>
            <div className="hint">{t("Use 10 characters or more.")}</div>
            <label className="consent">
              <input type="checkbox" required />
              <span>
                <PortalText
                  text={t(
                    'I’m 18 or older, and I’m a parent, guardian, or authorized adult creating this account. I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy note</a>.',
                  )}
                />
              </span>
            </label>
          </>
        )}
        <button className="primary" disabled={loading}>
          {t(
            loading
              ? "Working..."
              : signup
                ? "Create my free account"
                : "Sign in",
          )}{" "}
          <span>→</span>
        </button>
      </form>
      <p className="switch">
        {t(signup ? "Already have an account?" : "New to StoryPal?")}{" "}
        <Link href={signup ? "/login" : "/signup"}>
          {t(signup ? "Sign in" : "Create an account")}
        </Link>
      </p>
      <div className="privacy-note">
        <span>♧</span>
        <p>
          {t(
            signup
              ? "Kids don't create accounts here. A grown-up stays in charge of their StoryPal space."
              : "Your session is a random token stored only in this browser. Sign out from any device under Settings.",
          )}
        </p>
      </div>
    </section>
  );
}

/** @module Sign-up page story illustration */
export function PortalLanding({ onSignedIn }) {
  const { t } = useTranslation();
  return (
    <main className="layout">
      <section className="intro">
        <div className="eyebrow">
          <span />
          {t("A softer way through the day")}
        </div>
        <h1>
          <PortalText
            text={t("Every big moment<br>can become a <em>story.</em>")}
          />
        </h1>
        <p className="lede">
          {t(
            "Create a safe space to talk about feelings, practice new routines, and imagine what comes next — one little story at a time.",
          )}
        </p>
        <div className="story-card">
          <div className="card-top">
            <span className="sun">☀</span>
            <span className="tag">{t("TODAY'S LITTLE ADVENTURE")}</span>
            <span className="dots">•••</span>
          </div>
          <PortalIllustration />
          <div className="story-copy">
            <div className="story-title">{t("A New Day at School")}</div>
            <p>
              {t(
                "“I can feel a little wobbly and still take one small step. My grown-up will be there when the day is done.”",
              )}
            </p>
            <div className="read-row">
              <span>
                {t("♡ &nbsp;A story for brave beginnings").replaceAll(
                  "&nbsp;",
                  " ",
                )}
              </span>
              <span className="play">▶</span>
            </div>
          </div>
        </div>
        <div className="trust-row">
          <span>
            {t("✳ &nbsp;Made for grown-ups and kids, together").replaceAll(
              "&nbsp;",
              " ",
            )}
          </span>
          <span>{t("♡ &nbsp;Gentle by design").replaceAll("&nbsp;", " ")}</span>
          <span>
            {t("☁ &nbsp;Nothing leaves this computer").replaceAll(
              "&nbsp;",
              " ",
            )}
          </span>
        </div>
      </section>
      <PortalAuth signup onSignedIn={onSignedIn} />
    </main>
  );
}
