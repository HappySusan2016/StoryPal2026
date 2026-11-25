/* Generate a complete story in one request using the signed-in account's child profile. */
import { candidateModels, fetchGemini } from "../../lib/gemini";
import { reserveStepQuota, settleStepQuota } from "../../lib/stepQuota";
import { buildStoryPrompt, normalizeGeneratedChoices, toStoryModuleSteps, validateGeneratedStory } from "../../lib/generatedStory";
import { getStorySetup, storySteps } from "../../lib/storyWorkshop";

export const maxDuration = 60;

/** Log only the model's status code. The upstream body may contain profile data. */
function getGeminiStatus(value) {
  return typeof value === "string" && /^[A-Z_]{1,40}$/.test(value) ? value : undefined;
}

/** Reuse account authentication and generation quota handling, and release the quota on failure. */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Story generation is unavailable." }, { status: 503 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input.childId !== "string" || !/^[^/]{1,160}$/.test(input.childId)
    || input.childId === "." || input.childId === ".."
    || !storySteps.every((key) => typeof input.picks?.[key] === "string"
      && /^(?:[0-8]|other|focus)$/.test(input.picks[key]))
    || !storySteps.every((key) => typeof input.custom?.[key] === "string" && input.custom[key].length <= 500)) {
    return Response.json({ error: "Check your story choices and try again." }, { status: 400 });
  }

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
  let quota;
  let settled = false;
  const attempts = [];
  try {
    quota = await reserveStepQuota(request);
    signal.throwIfAborted();
    const passport = await quota.db.collection("users").doc(quota.uid).collection("passports").doc(input.childId).get();
    if (!passport.exists) return Response.json({ error: "Profile not found." }, { status: 404 });
    const setup = getStorySetup(passport.data(), input.picks, input.custom);
    if (!["SCENARIO", "FOCUS", "TONE", "PARENT_GOAL"].every((key) => setup.values[key])) {
      return Response.json({ error: "Check your story choices and remove personal details from custom answers." }, { status: 400 });
    }

    const prompt = buildStoryPrompt(setup);
    let correction = "";
    let modelIndex = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let generated;
      for (; modelIndex < candidateModels.length; modelIndex += 1) {
        const model = candidateModels[modelIndex];
        const response = await fetchGemini(`${model}:generateContent`, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt }] },
            contents: [{ role: "user", parts: [{ text: correction
              ? `Generate the complete story again. Fix this issue: ${correction}`
              : "Generate the complete story now." }] }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.4 },
          }),
          signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          signal.throwIfAborted();
          attempts.push({ model, attempt: attempt + 1, httpStatus: response.status, upstreamStatus: getGeminiStatus(payload?.error?.status) });
          if (response.status === 429) {
            return Response.json({ error: "Too many generation requests. Please try again later.", attempts }, { status: 429 });
          }
          continue;
        }
        const payload = await response.json().catch(() => null);
        signal.throwIfAborted();
        const candidate = payload?.candidates?.[0];
        const finishReason = getGeminiStatus(candidate?.finishReason);
        const blockReason = getGeminiStatus(payload?.promptFeedback?.blockReason);
        const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || "").join("");
        if (!text?.trim()) {
          correction = blockReason ? `Gemini blocked the request (${blockReason}).`
            : finishReason ? `Gemini returned no story text (${finishReason}).`
            : "Gemini returned no story text.";
        } else {
          try {
            generated = JSON.parse(text);
            normalizeGeneratedChoices(generated, setup);
            correction = validateGeneratedStory(generated, setup);
          } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            correction = finishReason === "MAX_TOKENS"
              ? "Gemini reached its output limit before returning complete JSON."
              : "Gemini returned invalid story JSON.";
          }
        }
        if (correction) attempts.push({ model, attempt: attempt + 1, finishReason, blockReason, reason: correction });
        break;
      }
      if (modelIndex === candidateModels.length) break;
      if (!correction) {
        const steps = toStoryModuleSteps(generated.pages);
        signal.throwIfAborted();
        await settleStepQuota(quota, true);
        settled = true;
        return Response.json({ steps });
      }
    }
    const lastAttempt = attempts.at(-1);
    const reason = lastAttempt?.reason || (lastAttempt
      ? `Gemini request failed (HTTP ${lastAttempt.httpStatus}${lastAttempt.upstreamStatus ? `, ${lastAttempt.upstreamStatus}` : ""}).`
      : "No Gemini model could be reached.");
    console.warn("Story generation failed", attempts);
    return Response.json({ error: "AI could not generate a valid story. Please try again.", reason, attempts }, { status: 502 });
  } catch (error) {
    if (error.status) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Story generation is unavailable. Please try again." }, { status: signal.aborted ? 504 : 503 });
  } finally {
    if (quota && !settled) {
      await settleStepQuota(quota, false).catch(() => console.error("Failed to release story generation quota"));
    }
  }
}
