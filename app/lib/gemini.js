/* Server-side Gemini requests use a proxy only in local development, without changing global network settings. */
import { ProxyAgent, fetch as proxyFetch } from "undici";

// Try a short fallback list, then auto-discover via ListModels if needed.
export const candidateModels = [
  "models/gemini-2.5-flash",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-001",
  "models/gemini-1.5-flash-001",
  "models/gemini-1.5-flash-latest",
  "models/gemini-1.5-pro-002",
];

// Enable the proxy only in development when a proxy address is configured. Otherwise, connect directly.
const proxyAgent = process.env.NODE_ENV === "development" && process.env.DEV_PROXY_URL
  ? new ProxyAgent(process.env.DEV_PROXY_URL)
  : null;

/** Send a request to the Gemini API. In production, connect directly via native fetch. */
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
