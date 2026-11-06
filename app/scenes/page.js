"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NavLinks from "../components/NavLinks";
import { SCENES } from "../lib/defaultScenes";

const USER_KEY = "sp.userName";
const DOCTOR_KEY = "sp.doctorName";

export default function ScenesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const userName = window.sessionStorage.getItem(USER_KEY) || "";
    const doctorName = window.sessionStorage.getItem(DOCTOR_KEY) || "";
    if (!userName || !doctorName) {
      router.replace("/onboarding");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-semibold text-zinc-900">Scenes</h1>
            <NavLinks />
          </div>
          <p className="mt-2 text-zinc-700">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-semibold text-zinc-900">Choose a Scene</h1>
          <NavLinks />
        </div>
        <p className="mt-2 text-zinc-700">Tap a card to play.</p>

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
                  alt={scene.title}
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="text-zinc-900 font-semibold leading-snug">
                {scene.title}
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}


