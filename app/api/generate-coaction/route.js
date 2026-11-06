import { GoogleGenerativeAI } from "@google/generative-ai";

// Define a list of fallback models to try
const MODEL_FALLBACKS = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-001",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-002",
];

export async function POST(req) {
  try {
    const { stepType, stepMessage, storyTitle, childContext } = await req.json();

    if (!stepType || !stepMessage) {
      return Response.json(
        { error: "Missing required fields: stepType, stepMessage" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return Response.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Build the prompt for generating co-action guidance
    const systemPrompt = `You are an expert in parent-child co-action for children with autism and communication needs. Your role is to generate helpful, concise co-action prompts for parents to use when going through interactive stories with their children.

Co-action means parents and children working together, with the parent providing scaffolding and support while respecting the child's autonomy and pace.

Guidelines:
- Keep prompts SHORT (1-2 sentences max)
- Be specific and actionable
- Focus on engagement, validation, and patience
- Use warm, encouraging language
- Consider the child's potential communication challenges
- Provide concrete examples of what parents can say or do

Return ONLY a JSON object with these fields:
{
  "title": "A short title for this guidance (2-4 words)",
  "description": "Brief context about this moment (1 sentence)",
  "coActionPrompt": "The specific action or phrase parents should use (1-2 sentences)"
}`;

    const userPrompt = `Story: "${storyTitle || "Interactive Story"}"
Step Type: ${stepType}
Step Content: "${stepMessage}"
${childContext ? `Child Context: ${JSON.stringify(childContext)}` : ""}

Generate a co-action prompt for this story step.`;

    // Function calling schema for structured output
    const coActionSchema = {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short title for the guidance (2-4 words)",
        },
        description: {
          type: "string",
          description: "Brief context about this moment (1 sentence)",
        },
        coActionPrompt: {
          type: "string",
          description: "Specific action or phrase for parents (1-2 sentences)",
        },
      },
      required: ["title", "description", "coActionPrompt"],
    };

    let lastError = null;
    let triedModels = [];

    // Try each model in sequence
    for (const modelName of MODEL_FALLBACKS) {
      try {
        triedModels.push(modelName);
        const model = genAI.getGenerativeModel({
          model: modelName,
        });

        const payload = {
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          tools: [
            {
              functionDeclarations: [
                {
                  name: "return_coaction_guide",
                  description:
                    "Returns a co-action guide for parents with title, description, and prompt",
                  parameters: coActionSchema,
                },
              ],
            },
          ],
        };

        const result = await model.generateContent(payload);
        const resp = result.response;

        // Extract function call
        const candidate = resp.candidates?.[0];
        const content = candidate?.content;
        const parts = content?.parts || [];

        for (const part of parts) {
          if (part.functionCall?.name === "return_coaction_guide") {
            const guide = part.functionCall.args;
            if (guide.title && guide.description && guide.coActionPrompt) {
              return Response.json({
                guide,
                model: modelName,
              });
            }
          }
        }

        // If we got here, no valid function call was found
        lastError = { message: "No valid function call in response" };
      } catch (error) {
        console.error(`Model ${modelName} failed:`, error.message);
        
        // Check for rate limit (429)
        if (error.message?.includes("429") || error.message?.includes("quota")) {
          // Extract retry delay if available
          const retryMatch = error.message.match(/retry in ([\d.]+)s/i);
          const retryAfterSeconds = retryMatch
            ? Math.ceil(parseFloat(retryMatch[1]))
            : 60;

          // Check if quota is fully exhausted (limit: 0)
          const isQuotaExhausted = error.message?.includes("limit: 0") || 
                                  error.message?.includes("Quota exceeded");
          
          // If quota is exhausted on the first model, don't try other models
          if (isQuotaExhausted && triedModels.length === 1) {
            console.warn("Free tier quota exhausted, skipping other models");
            return Response.json(
              {
                error: "Quota exhausted",
                retryAfterSeconds,
                message: `AI co-action generation is unavailable. Free tier quota has been exhausted. Fallback prompts will be used.`,
                quotaExhausted: true,
              },
              { status: 429 }
            );
          }

          return Response.json(
            {
              error: "Rate limit exceeded",
              retryAfterSeconds,
              message: `Please wait ${retryAfterSeconds} seconds before trying again.`,
            },
            { status: 429 }
          );
        }

        lastError = error;
      }
    }

    // All models failed
    console.error("All models failed. Last error:", lastError);
    return Response.json(
      {
        error: "AI generation failed",
        details: lastError?.message || "Unknown error",
        triedModels,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Co-action generation error:", error);
    return Response.json(
      { error: "Failed to generate co-action prompt", details: error.message },
      { status: 500 }
    );
  }
}

