// ZOZ GPU lifecycle adapter.
// Optional control-plane API: start a GPU worker only when a render job needs it,
// then stop it after the job. If no lifecycle API is configured, the worker is
// treated as externally managed and ZOZ never invents a provider-specific API.
const START_URL = String(process.env.ZOZ_GPU_START_URL || "").replace(/\/$/, "");
const STOP_URL = String(process.env.ZOZ_GPU_STOP_URL || "").replace(/\/$/, "");
const SECRET = String(process.env.ZOZ_GPU_LIFECYCLE_SECRET || process.env.RENDERER_INTERNAL_SECRET || "");

function configured() {
  return Boolean(START_URL && STOP_URL);
}

async function call(url, payload, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {})
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { text: text.slice(0, 500) }; }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureForJob(job) {
  if (!configured()) return { ok: true, mode: "external_or_manual", started: false, reason: "gpu_lifecycle_api_not_configured" };
  try {
    const result = await call(START_URL, { action: "start", jobId: job.jobId, section: job.section });
    if (!result.ok) return { ok: false, mode: "api_controlled", started: false, reason: "gpu_start_rejected", httpStatus: result.status };
    return { ok: true, mode: "api_controlled", started: true, startedAt: new Date().toISOString(), provider: result.body?.provider || null, workerId: result.body?.workerId || null };
  } catch (error) {
    return { ok: false, mode: "api_controlled", started: false, reason: "gpu_start_unreachable", detail: error.message };
  }
}

async function releaseForJob(job) {
  if (!configured()) return { ok: true, mode: "external_or_manual", stopped: false, reason: "gpu_lifecycle_api_not_configured" };
  try {
    const result = await call(STOP_URL, { action: "stop", jobId: job.jobId, section: job.section });
    if (!result.ok) return { ok: false, mode: "api_controlled", stopped: false, reason: "gpu_stop_rejected", httpStatus: result.status };
    return { ok: true, mode: "api_controlled", stopped: true, stoppedAt: new Date().toISOString(), provider: result.body?.provider || null, workerId: result.body?.workerId || null };
  } catch (error) {
    return { ok: false, mode: "api_controlled", stopped: false, reason: "gpu_stop_unreachable", detail: error.message };
  }
}

function status() {
  return {
    mode: configured() ? "api_controlled_on_demand" : "external_or_manual",
    configured: configured(),
    autoStart: configured(),
    autoStop: configured()
  };
}

module.exports = { configured, ensureForJob, releaseForJob, status };
