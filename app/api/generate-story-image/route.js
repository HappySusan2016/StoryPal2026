/* Generate storybook illustrations with Gemini for signed-in accounts. */
import { fetchGemini } from "../../lib/gemini";
import { getFirestore } from "firebase-admin/firestore";
import { verifyGenerationAccount } from "../../lib/firebaseAdmin";
import { screenStoryText } from "../../lib/storyWorkshop";

export const maxDuration = 60;

const maxDescriptionLength = 1600;
const maxImageBytes = 3 * 1024 * 1024;
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const childVariable = /@child(?:\.\w+)+|\{\{\s*child(?:\.\w+)+\s*\}\}/gi;

/** Send only the sanitized scene description. Use the child's profile on the server to replace names. */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Image generation is unavailable. Please try again later." }, { status: 503 });
  const input = await request.json().catch(() => null);
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const childId = input?.childId;
  if (!description || description.length > maxDescriptionLength
    || (childId != null && (typeof childId !== "string" || !/^[^/]{1,160}$/.test(childId) || childId === "." || childId === ".."))) {
    return Response.json({ error: "Enter an illustration description of at most 1,600 characters." }, { status: 400 });
  }

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
  try {
    const { app, uid } = await verifyGenerationAccount(request);
    signal.throwIfAborted();
    const passport = childId
      ? await getFirestore(app).collection("users").doc(uid).collection("passports").doc(childId).get()
      : null;
    const name = passport?.data()?.childName;
    const scene = screenStoryText(description.replace(childVariable, "the child"), typeof name === "string" ? name : "", maxDescriptionLength)
      .replaceAll("@child.name", "the child");
    if (!scene) {
      return Response.json({ error: "Remove personal details from the illustration description and try again." }, { status: 400 });
    }

    const response = await fetchGemini("models/gemini-2.5-flash-image:generateContent", apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Create one landscape children's picture-book illustration in a 3:2 aspect ratio. Use soft colors, simple shapes, and a calm composition. Draw only the scene described below. Do not include words or letters.\n\nScene: " + scene }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:2" } },
      }),
      signal,
    });
    if (response.status === 429) {
      return Response.json({ error: "Too many generation requests. Please try again later." }, { status: 429 });
    }
    const payload = response.ok ? await response.json().catch(() => null) : null;
    const image = payload?.candidates?.[0]?.content?.parts?.find((part) => !part.thought && imageTypes.has(part.inlineData?.mimeType))?.inlineData;
    if (typeof image?.data !== "string" || !image.data || image.data.length > Math.ceil(maxImageBytes / 3) * 4) {
      return Response.json({ error: "AI could not generate an illustration. Please try again." }, { status: 502 });
    }

    const bytes = Buffer.from(image.data, "base64");
    if (!bytes.length || bytes.length > maxImageBytes) {
      return Response.json({ error: "AI could not generate an illustration. Please try again." }, { status: 502 });
    }
    signal.throwIfAborted();
    return new Response(bytes, { headers: { "Content-Type": image.mimeType, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error.status === 401) return Response.json({ error: "Please sign in again." }, { status: 401 });
    return Response.json({ error: signal.aborted ? "Image generation timed out. Please try again." : "Image generation is unavailable. Please try again later." },
      { status: signal.aborted ? 504 : 503 });
  }
}
