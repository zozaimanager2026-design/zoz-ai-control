// ZOZ Kaggle control plane: read/status only until credentials are configured.
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
function status() { return { configured: configured(), kernel: KERNEL || null, apiBase: API_BASE, authMode: TOKEN ? "oauth_token" : (USER && KEY ? "api_key" : "missing"), policy: "read/status first; no notebook mutation by default" }; }
async function kernelStatus() {
  const base = status();
  if (!configured()) return base;
  const parts = KERNEL.split("/", 2);
  if (parts.length !== 2) return { ...base, error: "kaggle_kernel_must_be_owner_slash_slug" };
  const response = await fetch(API_BASE + "/kernels/status?userName=" + encodeURIComponent(parts[0]) + "&kernelSlug=" + encodeURIComponent(parts[1]), { headers: authHeaders() });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = { text: text.slice(0, 500) }; }
  return { ...base, ok: response.ok, httpStatus: response.status, result: body };
}
module.exports = { configured, status, kernelStatus };
