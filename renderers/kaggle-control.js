// ZOZ Kaggle control plane: authenticated status, pull, push and output retrieval.
// Execution is opt-in and requires a Kaggle API token stored only in Railway secrets.
const API_BASE = String(process.env.ZOZ_KAGGLE_API_BASE || "https://www.kaggle.com/api/v1").replace(/\/$/, "");
const KERNEL = String(process.env.ZOZ_KAGGLE_KERNEL || "").trim();
const TOKEN = String(process.env.KAGGLE_API_TOKEN || "").trim();
const USER = String(process.env.KAGGLE_USERNAME || "").trim();
const KEY = String(process.env.KAGGLE_KEY || "").trim();

function authHeaders() {
  if (TOKEN) return { Authorization: "Bearer " + TOKEN };
  if (USER && KEY) return { Authorization: "Basic " + Buffer.from(USER + ":" + KEY).toString("base64") };
  return {};
}
function configured() { return Boolean(KERNEL && (TOKEN || (USER && KEY))); }
function kernelParts() {
  const parts = KERNEL.split("/", 2);
  if (parts.length !== 2) throw new Error("kaggle_kernel_must_be_owner_slash_slug");
  return parts;
}
function status() {
  return {
    configured: configured(),
    kernel: KERNEL || null,
    apiBase: API_BASE,
    authMode: TOKEN ? "oauth_token" : (USER && KEY ? "api_key" : "missing"),
    executionEnabled: process.env.ZOZ_KAGGLE_ALLOW_EXECUTE === "true",
    policy: "authenticated Kaggle API control; execution remains opt-in"
  };
}
async function parseResponse(response) {
  const contentType = String(response.headers.get("content-type") || "");
  if (contentType.includes("application/json")) {
    const text = await response.text();
    try { return text ? JSON.parse(text) : null; } catch { return { text: text.slice(0, 1000) }; }
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { binary: true, bytes, contentType };
}
async function apiRequest(path, options = {}) {
  if (!configured()) return { ok: false, status: 503, body: status() };
  const response = await fetch(API_BASE + path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const body = await parseResponse(response);
  return { ok: response.ok, status: response.status, body };
}
async function kernelStatus() {
  const base = status();
  if (!configured()) return base;
  const [owner, slug] = kernelParts();
  const result = await apiRequest("/kernels/status?userName=" + encodeURIComponent(owner) + "&kernelSlug=" + encodeURIComponent(slug));
  return { ...base, ok: result.ok, httpStatus: result.status, result: result.body };
}
async function pullKernel() {
  const [owner, slug] = kernelParts();
  return apiRequest("/kernels/pull?userName=" + encodeURIComponent(owner) + "&kernelSlug=" + encodeURIComponent(slug));
}
async function kernelOutput() {
  const [owner, slug] = kernelParts();
  return apiRequest("/kernels/output?userName=" + encodeURIComponent(owner) + "&kernelSlug=" + encodeURIComponent(slug));
}
async function pushKernel({ text, newTitle = "ZOZ AI Kaggle Renderer", language = "python", kernelType = "script", enableGpu = true, enableInternet = true, isPrivate = true, machineShape = "Gpu", run = true }) {
  if (!configured()) return { ok: false, status: 503, body: status() };
  if (process.env.ZOZ_KAGGLE_ALLOW_EXECUTE !== "true") return { ok: false, status: 403, body: { error: "kaggle_execution_disabled", policy: status() } };
  if (typeof text !== "string" || !text.trim()) return { ok: false, status: 400, body: { error: "kernel_text_required" } };
  const body = {
    slug: KERNEL,
    newTitle,
    text,
    language,
    kernelType,
    isPrivate,
    enableGpu,
    enableInternet,
    machineShape
  };
  if (!run) body.noRun = true;
  return apiRequest("/kernels/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function executeKernelCode(text, options = {}) {
  return pushKernel({ text, ...options, run: true });
}
module.exports = { configured, status, kernelStatus, pullKernel, kernelOutput, pushKernel, executeKernelCode };
