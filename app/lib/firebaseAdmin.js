/* Firebase 服务端初始化：管理服务身份、开发代理和 Admin 实例复用。 */
import { HttpsProxyAgent } from "https-proxy-agent";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";

/** 获取独立的服务端 Firebase 实例，支持托管身份或环境变量凭证。 */
export function getAdminApp() {
  const existing = getApps().find((app) => app.name === "storypal-server");
  if (existing) return existing;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  // 仅开发环境读取代理配置，同时覆盖验签公钥和凭证换取令牌的请求。
  const httpAgent = process.env.NODE_ENV === "development" && process.env.DEV_PROXY_URL
    ? new HttpsProxyAgent(process.env.DEV_PROXY_URL)
    : undefined;
  return initializeApp({
    credential: credentials ? cert(JSON.parse(credentials), httpAgent) : applicationDefault(httpAgent),
    httpAgent,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }, "storypal-server");
}

