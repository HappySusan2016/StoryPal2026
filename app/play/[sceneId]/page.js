"use client";

import { useTranslation } from "../../hooks/useTranslation";
import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { SCENES, getDefaultStorySteps } from "../../lib/defaultScenes";
import { useSceneContext } from "../../hooks/useSceneContext";
import StoryPlayer from "../../components/StoryPlayer";
import Link from "next/link";

export default function PlayScenePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { ready, context: templateContext } = useSceneContext();

  const sceneId = Number(params?.sceneId);
  const scene = SCENES.find((s) => s.id === sceneId) || null;

  // Share the onboarding session with the scene list to preserve the existing return flow.
  useEffect(() => {
    if (ready && !templateContext) router.replace("/onboarding");
  }, [ready, templateContext, router]);

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
      <div className="storypal-legacy min-h-screen bg-background px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-semibold text-zinc-900">{t("Scene not found")}</h1>
          <Link href="/scenes" className="text-[#315e4a] hover:underline mt-4 inline-block">{t("Back to Scenes")}</Link>
        </div>
      </div>
    );
  }

  if (!templateContext || !moduleDefinition) {
    return (
      <div className="storypal-legacy min-h-screen bg-background px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-semibold text-zinc-900">{t("Loading…")}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="storypal-legacy min-h-screen bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-zinc-900">{scene.title}</h1>
          <Link href="/scenes" className="text-[#315e4a] hover:underline">{t("Back to Scenes")}</Link>
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


