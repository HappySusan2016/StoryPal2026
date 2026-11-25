/* Server-side Firebase setup for service identity, development proxies, and Admin instance reuse. */
import { getAuth } from "firebase-admin/auth";
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


/** Authenticate generation requests and return the server-side Firebase instance and account ID. */
export async function verifyGenerationAccount(req) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error("Please sign in to generate a step."), { status: 401, code: "UNAUTHORIZED" });
  const app = getAdminApp();
  let uid;
  try {
    ({ uid } = await getAuth(app).verifyIdToken(token));
  } catch (error) {
    // Treat only invalid tokens as sign-in errors and let the caller handle infrastructure failures.
    if (/^auth\/(argument-error|invalid-id-token|id-token-expired|id-token-revoked|user-disabled)$/.test(error.code || "")) {
      throw Object.assign(new Error("Please sign in again."), { status: 401, code: "UNAUTHORIZED" });
    }
    throw error;
  }
  return { app, uid };
}
