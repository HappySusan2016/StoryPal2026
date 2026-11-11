/* Gemini 服务端请求：仅本地开发使用代理，不修改全局网络配置。 */
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

// 与参考项目保持一致，代理地址指向本机代理服务。
const proxyAgent = process.env.NODE_ENV === "development"
  ? new ProxyAgent("http://127.0.0.1:7890")
  : null;

/** 向 Gemini API 发送请求；生产环境使用原生 fetch 直连。 */
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
