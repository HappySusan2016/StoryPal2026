import { candidateModels, fetchGemini } from "@/app/lib/gemini";

import { reserveStepQuota, settleStepQuota } from "@/app/lib/stepQuota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listModels(apiKey, signal) {
  const resp = await fetchGemini(
    "models",
    apiKey,
    { method: "GET", signal }
  );
  if (!resp.ok) return [];
  const data = await resp.json().catch(() => ({}));
  return Array.isArray(data?.models) ? data.models : [];
}

function pickModelFromList(models) {
  // Prefer a "flash" text model that supports generateContent.
  const supportsGenerate = (m) =>
    Array.isArray(m?.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes("generateContent");

  const good = models.filter(supportsGenerate);
  const prefer = good.find((m) => /flash/i.test(m?.name || "")) || good[0];
  // API expects "models/xyz"
  return prefer?.name || null;
}

function stripCodeFences(text) {
  if (!text) return "";
  const trimmed = String(text).trim();
  // Remove ```json ... ``` or ``` ... ```
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
  }
  return trimmed;
}

function extractJsonObject(text) {
  const s = String(text || "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return "";
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  const out = [];
  for (const s of rawSteps) {
    const type = s?.type;
    if (!["doctor", "user-input", "choice"].includes(type)) continue;
    if (!isNonEmptyString(s?.message)) continue;

    const step = { type, message: String(s.message).trim() };
    if (type === "user-input") {
      step.placeholder = isNonEmptyString(s?.placeholder)
        ? String(s.placeholder).trim()
        : "Type your answer here…";
    }
    if (type === "choice") {
      const opts = Array.isArray(s?.options)
        ? s.options.map((o) => String(o || "").trim()).filter(Boolean)
        : [];
      if (opts.length < 2) continue;
      step.options = opts.slice(0, 6);
    }
    if (isNonEmptyString(s?.imageUrl)) {
      step.imageUrl = String(s.imageUrl).trim();
    }
    out.push(step);
    if (out.length >= 12) break;
  }
  return out;
}

function normalizeOneStep(rawStep) {
  if (!rawStep || typeof rawStep !== "object") return null;
  const type = rawStep?.type;
  if (!["doctor", "user-input", "choice"].includes(type)) return null;
  if (!isNonEmptyString(rawStep?.message)) return null;

  const step = { type, message: String(rawStep.message).trim() };
  if (type === "user-input") {
    step.placeholder = isNonEmptyString(rawStep?.placeholder)
      ? String(rawStep.placeholder).trim()
      : "Type your answer here…";
  }
  if (type === "choice") {
    const opts = Array.isArray(rawStep?.options)
      ? rawStep.options.map((o) => String(o || "").trim()).filter(Boolean)
      : [];
    if (opts.length < 2) return null;
    step.options = opts.slice(0, 4);
  }
  if (isNonEmptyString(rawStep?.imageUrl)) {
    step.imageUrl = String(rawStep.imageUrl).trim();
  }
  return step;
}

async function callGemini({ apiKey, modelName, payload, signal }) {
  const resp = await fetchGemini(
    `${modelName}:generateContent`,
    apiKey,
    {
      signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
    // Retry delay can come from header or JSON error details
    let retryAfterSeconds = null;
    const headerRetry = resp.headers.get("retry-after");
    if (headerRetry && !Number.isNaN(Number(headerRetry))) {
      retryAfterSeconds = Number(headerRetry);
    }
    if (!retryAfterSeconds && json?.error?.details) {
      const retryInfo = json.error.details.find(
        (d) => d && d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
      );
      const delay = retryInfo?.retryDelay; // e.g. "23s"
      if (typeof delay === "string" && delay.endsWith("s")) {
        const secs = Number(delay.slice(0, -1));
        if (!Number.isNaN(secs)) retryAfterSeconds = secs;
      }
    }
    return { ok: false, status: resp.status, text, json, retryAfterSeconds };
  }
  const json = await resp.json().catch(() => ({}));
  return { ok: true, status: resp.status, json };
}

function getCandidateText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .filter(Boolean)
      .join("\n") || ""
  );
}

function tryParseJsonFromText(text) {
  const jsonText = stripCodeFences(text);
  try {
    return JSON.parse(jsonText);
  } catch {
    const extracted = extractJsonObject(jsonText);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** @module 步骤生成请求时限 */
export async function POST(req) {
  // 所有模型尝试和格式修复共用 50 秒预算，客户端断开时同步取消。
  const timeoutSignal = AbortSignal.timeout(50000);
  const signal = AbortSignal.any([req.signal, timeoutSignal]);
  let quota = null;
  let quotaSettled = false;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error:
            "Missing GEMINI_API_KEY. Add it to your environment variables and restart the dev server.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    quota = await reserveStepQuota(req);
    signal.throwIfAborted();
    const stages = body?.stages || {};
    const currentTitle = isNonEmptyString(body?.currentTitle)
      ? String(body.currentTitle).trim()
      : "";
    const previousSteps = Array.isArray(body?.previousSteps)
      ? body.previousSteps
          .filter((s) => s && typeof s === "object")
          .slice(-6)
          .map((s) => ({
            type: s.type,
            message: isNonEmptyString(s.message) ? String(s.message).trim() : "",
            placeholder: isNonEmptyString(s.placeholder)
              ? String(s.placeholder).trim()
              : "",
            options: Array.isArray(s.options)
              ? s.options.map((o) => String(o || "").trim()).filter(Boolean).slice(0, 6)
              : [],
          }))
      : [];

    const system = `
You generate ONE StoryPal story step at a time.
Return structured data via function calling when possible.

Rules:
- Child-safe, supportive, neurodiversity-affirming language.
- Prefer template variables like @child.name, @child.pronouns.subject, @child.pronouns.object.
- Do NOT include any personally identifying info.
- If you output a choice step, provide 2-4 short options.
`;

    const userPrompt = `
Create ONE next step based on the following stage design context.
Return an object with optional title and a required step.
Continue the existing story if previousSteps are provided:
- If previousSteps is non-empty, DO NOT re-introduce the story, do not say "welcome" again.
- Make the next step logically follow the last step.
- Avoid repeating the same opening phrasing.

currentTitle: ${JSON.stringify(currentTitle)}
stages: ${JSON.stringify(stages)}
previousSteps: ${JSON.stringify(previousSteps)}
`;

    const oneStepSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        step: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["doctor", "user-input", "choice"] },
            message: { type: "string" },
            placeholder: { type: "string" },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 4,
            },
            imageUrl: { type: "string" },
          },
          required: ["type", "message"],
        },
      },
      required: ["step"],
    };

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: system }, { text: userPrompt }],
        },
      ],
      // Prefer function calling for deterministic structured output
      tools: [
        {
          functionDeclarations: [
            {
              name: "return_step",
              description:
                "Return ONE generated StoryPal step as structured data (optional title + step).",
              parameters: oneStepSchema,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["return_step"],
        },
      },
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 800,
      },
    };

    let chosenModel = null;
    let data = null;

    // 1) Try known model IDs first
    for (const m of candidateModels) {
      const r = await callGemini({ apiKey, modelName: m, payload, signal });
      if (r.ok) {
        chosenModel = m;
        data = r.json;
        break;
      }
      if (r.status === 429) {
        const retryAfterSeconds = r.retryAfterSeconds ?? 30;
        return Response.json(
          {
            error:
              "Gemini rate limit exceeded. Please wait and try again.",
            retryAfterSeconds,
            model: m,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfterSeconds) },
          }
        );
      }
      // if it's not found, keep trying; otherwise also keep trying
    }

    // 2) Auto-discover if all failed
    if (!data) {
      const models = await listModels(apiKey, signal);
      const picked = pickModelFromList(models);
      if (picked) {
        const r = await callGemini({ apiKey, modelName: picked, payload, signal });
        if (r.ok) {
          chosenModel = picked;
          data = r.json;
        }
      }
    }

    if (!data) {
      return Response.json(
        {
          error:
            "AI service could not generate a step. Please try again later.",
        },
        { status: 503 }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const fnCallPart = parts.find((p) => p && p.functionCall);
    const fnCall = fnCallPart?.functionCall || null;

    let parsed = null;
    if (fnCall?.name === "return_step" && fnCall?.args) {
      parsed =
        typeof fnCall.args === "string" ? tryParseJsonFromText(fnCall.args) : fnCall.args;
    }

    const text = getCandidateText(data);
    if (!parsed) {
      parsed = tryParseJsonFromText(text);
    }

    // If the model ignored schema/mimeType, do a second-pass "repair" call that converts to JSON.
    if (!parsed) {
      const repairPayload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Convert the following into VALID JSON that matches this schema:\n" +
                  JSON.stringify(
                    {
                      title: "string (optional)",
                      step: {
                        type: "doctor|user-input|choice",
                        message: "string",
                        placeholder: "string (user-input only, optional)",
                        options: ["string (choice only, 2-4)"],
                        imageUrl: "string (optional)",
                      },
                    },
                    null,
                    2
                  ) +
                  "\nReturn ONLY the JSON object. No markdown.\n\nINPUT:\n" +
                  text,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 800,
          // Keep repair simple (no tools) to maximize compatibility
        },
      };

      const repairModel = chosenModel || "models/gemini-2.5-flash";
      const repaired = await callGemini({
        apiKey,
        modelName: repairModel,
        payload: repairPayload,
        signal,
      });

      if (repaired.ok) {
        const repairedText = getCandidateText(repaired.json);
        parsed = tryParseJsonFromText(repairedText);
      }
    }

    if (!parsed) {
      return Response.json(
        {
          error: "Gemini returned non-JSON output. Try again.",
          model: chosenModel,
          rawPreview: text.slice(0, 800),
        },
        { status: 502 }
      );
    }

    const step = normalizeOneStep(parsed?.step || parsed);
    if (!step) {
      return Response.json(
        { error: "Gemini returned an invalid step. Try again.", model: chosenModel },
        { status: 502 }
      );
    }

    const title = isNonEmptyString(parsed?.title) ? String(parsed.title).trim() : null;

    signal.throwIfAborted();
    const usage = await settleStepQuota(quota, true);
    quotaSettled = true;
    return Response.json({ title, step, model: chosenModel, usage }, { status: 200 });
  } catch (err) {
    if (err?.code === "UNAUTHORIZED" || err?.code === "STEP_QUOTA_EXCEEDED") {
      return Response.json({ error: err.message, code: err.code, limit: err.limit,
        resetAt: err.resetAt, retryAfterSeconds: err.retryAfterSeconds }, {
        status: err.status,
        headers: err.retryAfterSeconds ? { "Retry-After": String(err.retryAfterSeconds) } : {},
      });
    }
    // 对外只返回简短原因，避免将上游错误正文暴露给页面。
    console.error("Step generation failed", { message: err });
    return Response.json(
      { error: timeoutSignal.aborted
        ? "AI generation timed out. Please try again."
        : "Unable to connect to the AI service. Please try again." },
      { status: timeoutSignal.aborted ? 504 : 503 }
    );
  } finally {
    if (quota && !quotaSettled) {
      try {
        await settleStepQuota(quota, false);
      } catch (error) {
        // 释放失败时由预占时限兜底，不把失败请求记入成功次数。
        console.error("Failed to release step quota", { code: error?.code });
      }
    }
  }
}


