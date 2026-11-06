"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SCENES, getDefaultStorySteps } from "../../lib/defaultScenes";
import StoryPlayer from "../../components/StoryPlayer";
import Link from "next/link";

const USER_KEY = "sp.userName";
const DOCTOR_KEY = "sp.doctorName";

export default function PlayScenePage() {
  const router = useRouter();
  const params = useParams();
  const [templateContext, setTemplateContext] = useState(null);

  const sceneId = Number(params?.sceneId);
  const scene = SCENES.find((s) => s.id === sceneId) || null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userName = window.sessionStorage.getItem(USER_KEY) || "";
    const doctorName = window.sessionStorage.getItem(DOCTOR_KEY) || "";
    if (!userName || !doctorName) {
      router.replace("/onboarding");
      return;
    }
    setTemplateContext({
      user: { name: userName },
      doctor: { name: doctorName },
    });
  }, [router]);

  const moduleDefinition = useMemo(() => {
    if (!scene) return null;
    return {
      id: `scene-${scene.id}`,
      title: scene.title,
      coverImage: scene.image,
      steps: getDefaultStorySteps(scene.id),
    };
  }, [scene]);

  if (!scene) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-semibold text-zinc-900">Scene not found</h1>
          <Link href="/scenes" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Scenes
          </Link>
        </div>
      </div>
    );
  }

  if (!templateContext || !moduleDefinition) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-semibold text-zinc-900">Loading…</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-zinc-900">{scene.title}</h1>
          <Link href="/scenes" className="text-blue-600 hover:underline">
            Back to Scenes
          </Link>
        </div>
      </div>

      <StoryPlayer
        moduleDefinition={moduleDefinition}
        templateContext={templateContext}
        onClose={() => router.push("/scenes")}
        onFinished={() => router.push("/scenes")}
      />
    </div>
  );
}


