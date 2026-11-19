/* Server-side Gemini model configuration and requests */
import { ProxyAgent, fetch as proxyFetch } from "undici";

// Prefer a lightweight model for short content and keep the existing 2.5 Flash model as a fallback.
export const candidateModels = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.5-flash-lite",
  "models/gemini-2.5-flash",
  "models/gemini-2.0-flash",
  "models/gemini-3.8-flash",

];

// Enable the proxy only when a proxy URL is configured for local development.
const proxyAgent = process.env.NODE_ENV === "development" && process.env.DEV_PROXY_URL
  ? new ProxyAgent(process.env.DEV_PROXY_URL)
  : null;

/** Call the Gemini API directly with native fetch in production. */
export function fetchGemini(path, apiKey, options = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${path}`;
  const requestOptions = {
    ...options,
    headers: { ...options.headers, "x-goog-api-key": apiKey },
  };
  return proxyAgent
    ? proxyFetch(url, { ...requestOptions, dispatcher: proxyAgent })
    : fetch(url, requestOptions);
}
