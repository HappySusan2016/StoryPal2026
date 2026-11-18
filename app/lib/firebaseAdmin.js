/* Server-side Firebase setup for service identity, development proxies, and Admin instance reuse. */
import { HttpsProxyAgent } from "https-proxy-agent";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";

/** Get a dedicated server-side Firebase instance using managed identity or environment-provided credentials. */
export function getAdminApp() {
  const existing = getApps().find((app) => app.name === "storypal-server");
  if (existing) return existing;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  // Read proxy settings only in development. Proxy both public-key fetches and credential-to-token requests.
  const httpAgent = process.env.NODE_ENV === "development" && process.env.DEV_PROXY_URL
    ? new HttpsProxyAgent(process.env.DEV_PROXY_URL)
    : undefined;
  return initializeApp({
    credential: credentials ? cert(JSON.parse(credentials), httpAgent) : applicationDefault(httpAgent),
    httpAgent,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }, "storypal-server");
}

