/* Telemetry regression tests for cached configuration, initial write coordination, error fields, and account isolation. All tests use local fakes. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const helperSource = await readFile(new URL("../app/lib/telemetry.js", import.meta.url), "utf8");
const helpers = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString("base64")}`);
const { decideTelemetryEnabled, cleanTelemetryPayload } = helpers;
const require = createRequire(import.meta.url);
const { transform, loadBindings } = require("next/dist/build/swc");
await loadBindings();
const providerSource = await readFile(new URL("../app/components/TelemetryProvider.js", import.meta.url), "utf8");
const compiled = await transform(providerSource, {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
  module: { type: "commonjs" },
});

/** Create controllable browser and Firestore fakes without connecting to external services. */
function createRecorder(commit = async () => {}, enabled = "true") {
  const effects = [];
  const batches = [];
  const stored = new Map([["sp.telemetry.enabled", "false"]]);
  const listeners = new Map();
  let authCallback;
  let nextEventId = 0;
  const browser = {
    sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    crypto: { randomUUID: () => "test-session" },
    setInterval: () => 1,
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: type => listeners.delete(type),
  };
  const firestore = {
    collection: (db, ...parts) => ({ path: parts.join("/") }),
    doc: (base, ...parts) => ({ path: parts.length ? parts.join("/") : `${base.path}/event-${++nextEventId}` }),
    serverTimestamp: () => "server-timestamp",
    writeBatch: () => {
      const writes = [];
      return {
        set: (ref, data) => writes.push({ path: ref.path, data }),
        commit: () => { batches.push(writes); return commit(writes, batches.length); },
      };
    },
  };
  const exports = {};
  const context = vm.createContext({
    exports,
    require: name => {
      if (name === "react") return { useRef: value => ({ current: value }), useEffect: callback => effects.push(callback) };
      if (name === "next/navigation") return { usePathname: () => "/" };
      if (name === "firebase/auth") return { onAuthStateChanged: (auth, callback) => { authCallback = callback; return () => {}; } };
      if (name === "firebase/firestore") return firestore;
      if (name === "../lib/firebaseClient") return { auth: {}, db: {} };
      if (name === "../lib/telemetry") return helpers;
      throw new Error(`Unexpected import: ${name}`);
    },
    process: { env: { NEXT_PUBLIC_TELEMETRY_ENABLED: enabled, NODE_ENV: "test" } },
    window: browser,
    document: { visibilityState: "visible", addEventListener: browser.addEventListener, removeEventListener: browser.removeEventListener },
    navigator: { userAgent: "test-browser" },
    console,
    clearInterval: () => {},
  });
  vm.runInContext(compiled.code, context);
  exports.default();
  const cleanup = effects.map(effect => effect());
  return { batches, telemetry: browser.storypalTelemetry, authenticate: user => authCallback(user), fire: (type, event) => listeners.get(type)?.(event), cleanup: () => cleanup.forEach(callback => callback?.()) };
}

test("启用后忽略旧版关闭缓存；当前关闭配置不可被旧缓存绕过", () => {
  const values = new Map([["sp.telemetry.enabled", "false"]]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(decideTelemetryEnabled(storage, true, 1, () => .5), true);
  assert.equal(decideTelemetryEnabled(storage, false, 1, () => .5), false);
  assert.equal(decideTelemetryEnabled(storage, true, 0, () => .5), false);
});

test("采样决定在同一配置下保持稳定，存储不可用时仍遵守采样率", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(decideTelemetryEnabled(storage, true, .5, () => .8), false);
  assert.equal(decideTelemetryEnabled(storage, true, .5, () => .1), false);
  const blocked = { getItem: () => { throw new Error("blocked"); } };
  assert.equal(decideTelemetryEnabled(blocked, true, 1, () => .5), true);
  assert.equal(decideTelemetryEnabled(blocked, true, 0, () => .5), false);
});

test("可选错误字段不再使 Firestore 整批写入失败", () => {
  assert.deepEqual(cleanTelemetryPayload({ message: "error", filename: undefined, lineno: 0, handled: false, href: null }), { message: "error", lineno: 0, handled: false, href: null });
});

test("手动刷新等待正在写入的首批事件，并记录登录后的首次页面访问", async () => {
  let resolveCommit;
  const pending = new Promise(resolve => { resolveCommit = resolve; });
  const recorder = createRecorder(() => pending);
  recorder.authenticate({ uid: "a" });
  let finished = false;
  const waiting = recorder.telemetry.flush().then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  resolveCommit();
  await waiting;
  assert.equal(recorder.batches.length, 1);
  assert.equal(recorder.batches[0][1].data.type, "session_start");
  assert.equal(recorder.batches[0][2].data.type, "page_view");
  assert.equal(recorder.batches[0][2].data.toPath, "/");
  assert.ok(recorder.telemetry.getStatus().lastFlushAt);
  recorder.cleanup();
});

test("写入失败会暴露状态，重试成功后清除错误", async () => {
  const recorder = createRecorder(async (writes, number) => {
    if (number === 1) throw Object.assign(new Error("denied"), { code: "permission-denied" });
  });
  recorder.authenticate({ uid: "a" });
  await recorder.telemetry.flush();
  assert.equal(recorder.telemetry.getStatus().lastError, "permission-denied");
  await recorder.telemetry.flush();
  assert.equal(recorder.telemetry.getStatus().lastError, null);
  assert.equal(recorder.batches.length, 2);
  recorder.cleanup();
});

test("账号切换后，旧账号失败事件不会回填到新账号队列", async () => {
  let rejectFirst;
  const pending = new Promise((resolve, reject) => { rejectFirst = reject; });
  const recorder = createRecorder((writes, number) => number === 1 ? pending : Promise.resolve());
  recorder.authenticate({ uid: "a" });
  recorder.telemetry.track("click", { name: "a-only" });
  recorder.authenticate({ uid: "b" });
  const waiting = recorder.telemetry.flush();
  rejectFirst(Object.assign(new Error("offline"), { code: "unavailable" }));
  await waiting;
  assert.equal(recorder.batches.length, 2);
  assert.ok(recorder.batches[1].every(write => write.path.startsWith("users/b/")));
  assert.ok(recorder.batches[1].every(write => write.data.name !== "a-only"));
  assert.equal(recorder.telemetry.getStatus().lastError, null);
  recorder.cleanup();
});

test("关闭时不会发送数据，仍可读取关闭状态", async () => {
  const recorder = createRecorder(async () => { throw new Error("Must not write"); }, "false");
  assert.equal(recorder.telemetry.getStatus().configured, false);
  recorder.telemetry.track("click", { name: "ignored" });
  await recorder.telemetry.flush();
  assert.equal(recorder.batches.length, 0);
  recorder.cleanup();
});

test("页面访问量只计算 page_view，零可见时长也参与平均值", () => {
  const events = [
    { type: "session_start", path: "/", ts: 1 },
    { type: "page_view", path: "/", ts: 2 },
    { type: "click", path: "/", name: "analytics", ts: 3 },
    { type: "page_time", path: "/", visibleMs: 0, totalMs: 1000, ts: 4 },
    { type: "page_time", path: "/analytics", visibleMs: 2000, totalMs: 3000, ts: 5 },
    { type: "page_view", path: "/analytics", ts: 6 },
  ];
  const stats = helpers.calculateAnalyticsStats([{ id: "a" }], events);
  assert.equal(stats.byPath["/"], 1);
  assert.equal(stats.byPath["/analytics"], 1);
  assert.equal(stats.totalEvents, 6);
  assert.equal(stats.avgVisibleMs, 1000);
  assert.equal(stats.avgTotalMs, 2000);
  assert.equal(stats.recentEvents[0].ts, 6);
  assert.equal(events[0].ts, 1);
});

test("最近错误按全局事件时间排序，避免不同会话顺序影响结果", () => {
  const events = [
    { type: "error", message: "older", ts: 1 },
    { type: "error", message: "newer", ts: 3 },
    { type: "error", message: "middle", ts: 2 },
  ];
  const stats = helpers.calculateAnalyticsStats([], events);
  assert.deepEqual(stats.errors.map(error => error.message), ["newer", "middle", "older"]);
});
