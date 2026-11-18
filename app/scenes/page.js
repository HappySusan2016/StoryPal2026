"use client";

import { useTranslation } from "../hooks/useTranslation";
import { useEffect } from "react";
import { useSceneContext } from "../hooks/useSceneContext";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NavLinks from "../components/NavLinks";
import { SCENES } from "../lib/defaultScenes";

export default function ScenesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ready, context } = useSceneContext();

  // Wait for the session to load before deciding whether to return to onboarding.
  useEffect(() => {
    if (ready && !context) router.replace("/onboarding");
  }, [ready, context, router]);

  if (!ready || !context) {
    return (
      <div className="storypal-legacy min-h-screen bg-background px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-semibold text-zinc-900">{t("Scenes")}</h1>
            <NavLinks />
          </div>
          <p className="mt-2 text-zinc-700">{t("Loading…")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="storypal-legacy min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-semibold text-zinc-900">{t("Choose a Scene")}</h1>
          <NavLinks />
        </div>
        <p className="mt-2 text-zinc-700">{t("Tap a card to play.")}</p>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => router.push(`/play/${scene.id}`)}
              className="text-left rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/80 backdrop-blur"
            >
              <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden mb-3">
                <Image
                  src={scene.image}
                  alt={t(scene.title)}
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="text-zinc-900 font-semibold leading-snug">
                {t(scene.title)}
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}


