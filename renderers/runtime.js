// ZOZ AI Independent Renderer Runtime
const fs = require("fs");
const path = require("path");
const { RENDERERS, resolveRenderer, buildRendererJob, getRenderPolicy } = require("./index");
const { createDefaultAdapters } = require("./local-executors");
const { renderImage: renderNativeImage } = require("./native-image-adapter");
const gpuLifecycle = require("./gpu-lifecycle");
const costMeter = require("./cost-meter");

const ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(ROOT, ".zoz-renderer");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const IMPROVEMENTS_FILE = path.join(STATE_DIR, "improvements.json");

function ensureStateDir() { fs.mkdirSync(STATE_DIR, { recursive: true }); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writeJson(file, value) { ensureStateDir(); const temp = `${file}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2)); fs.renameSync(temp, file); }
function createRuntimeState() {
  return {
    version: 4,
    status: "ready",
    rendererCount: Object.keys(RENDERERS).length,
    jobs: [],
    completed: 0,
    failed: 0,
    renderUsage: [],
    lastRunAt: null,
    selfDevelopment: { enabled: true, mode: "safe", pendingImprovements: 0 },
    nativeImage: { enabled: true, mode: "self-hosted", provider: "zoz-native-image-renderer" },
    gpuLifecycle: gpuLifecycle.status(),
    costModel: costMeter.config(),
    financialApprovalRequired: true
  };
}
function loadState() { return readJson(STATE_FILE, createRuntimeState()); }
function saveJsonState(state) { writeJson(STATE_FILE, state); }
function saveState(state) {
  state.lastRunAt = new Date().toISOString();
  state.rendererCount = Object.keys(RENDERERS).length;
  state.nativeImage = { enabled: true, mode: "self-hosted", provider: "zoz-native-image-renderer" };
  state.gpuLifecycle = gpuLifecycle.status();
  state.costModel = costMeter.config();
  if (!Array.isArray(state.renderUsage)) state.renderUsage = [];
  saveJsonState(state);
}
function inspectLibrary() {
  const failures = [];
  for (const [section, renderer] of Object.entries(RENDERERS)) {
    if (!renderer.id || !renderer.queue || !Array.isArray(renderer.capabilities)) failures.push({ section, reason: "invalid_renderer_contract" });
  }
  return {
    ok: failures.length === 0,
    rendererCount: Object.keys(RENDERERS).length,
    failures,
    policy: getRenderPolicy(),
    localExecution: true,
    nativeImage: { enabled: true, provider: "zoz-native-image-renderer" },
    gpuLifecycle: gpuLifecycle.status(),
    costModel: costMeter.config()
  };
}
function queue(task) {
  const job = buildRendererJob(task);
  if (!job.ok) return job;
  const state = loadState();
  const queued = { ...job, createdAt: new Date().toISOString(), status: "queued" };
  state.jobs.push(queued);
  if (state.jobs.length > 500) state.jobs = state.jobs.slice(-500);
  saveState(state);
  return queued;
}
function isGpuRenderJob(job) {
  return job?.section === "media" && (job?.input?.deliverables || []).some(item => ["images", "image", "thumbnail"].includes(String(item).toLowerCase()));
}
function appendUsage(state, usage) {
  state.renderUsage.push(usage);
  if (state.renderUsage.length > 500) state.renderUsage = state.renderUsage.slice(-500);
}
async function executeWithAccounting(job, adapter) {
  const usageStartedAt = Date.now();
  const lifecycle = await gpuLifecycle.ensureForJob(job);
  if (!lifecycle.ok) return { ok: false, status: "blocked", reason: lifecycle.reason, gpuLifecycle: lifecycle };
  const startedAt = lifecycle.startedAt ? Date.parse(lifecycle.startedAt) : usageStartedAt;
  let value;
  let adapterError = null;
  try { value = await adapter(job.input); }
  catch (error) { adapterError = error; value = { ok: false, status: "failed", reason: "renderer_execution_error", detail: error.message }; }
  const stoppedAt = Date.now();
  const stopped = lifecycle.started ? await gpuLifecycle.releaseForJob(job) : { ok: true, mode: lifecycle.mode, stopped: false, reason: "gpu_was_not_started_by_zoz" };
  const durationMs = Math.max(0, stoppedAt - startedAt);
  const billing = costMeter.estimateTotal({ gpuDurationMs: durationMs });
  const result = { ...(value || { ok: false, status: "failed", reason: "empty_renderer_result" }), gpuLifecycle: { start: lifecycle, stop: stopped }, billing: { ...billing, durationSeconds: Number((durationMs / 1000).toFixed(2)), mode: lifecycle.mode } };
  if (adapterError) result.error = adapterError.message;
  return result;
}
function execute(job, adapters = {}) {
  const state = loadState();
  const renderer = resolveRenderer({ serviceId: job.section, skills: job.input?.skills || [], deliverables: job.input?.deliverables || [] });
  if (!renderer) return Promise.resolve({ ok: false, reason: "renderer_not_registered" });
  if (job.approval?.financial && job.approval?.humanApprovalRequired !== false) return Promise.resolve({ ok: false, status: "approval_required", reason: "financial_approval_required" });
  const registry = { ...createDefaultAdapters(), ...adapters };
  if (renderer.section === "media" && (job.input?.deliverables || []).some(item => ["images", "image", "thumbnail"].includes(item))) registry[renderer.id] = renderNativeImage;
  const adapter = registry[renderer.id];
  if (typeof adapter !== "function") return Promise.resolve({ ok: false, status: "blocked", reason: "external_adapter_required", rendererId: renderer.id });
  const runningAt = new Date().toISOString();
  state.jobs = state.jobs.map(item => item.jobId === job.jobId ? { ...item, status: "running", startedAt: runningAt } : item);
  saveState(state);
  const work = isGpuRenderJob(job) ? executeWithAccounting(job, adapter) : Promise.resolve().then(() => adapter(job.input));
  return work.then(value => {
    const current = loadState();
    if (value?.billing) appendUsage(current, { jobId: job.jobId, rendererId: renderer.id, createdAt: runningAt, ...value.billing });
    current.completed += value?.ok === false ? 0 : 1;
    if (value?.ok === false) current.failed += 1;
    current.jobs = current.jobs.map(item => item.jobId === job.jobId ? { ...item, status: value?.ok === false ? "failed" : "completed", result: value, completedAt: new Date().toISOString() } : item);
    saveState(current);
    return value;
  });
}
async function executeQueued(jobId, adapters = {}) {
  const state = loadState();
  const job = state.jobs.find(item => item.jobId === jobId);
  if (!job) return { ok: false, reason: "job_not_found" };
  return execute(job, adapters);
}
async function renderImage(input = {}) {
  const job = {
    jobId: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    section: "media",
    input: { ...input, deliverables: ["image"] },
    approval: { financial: false, humanApprovalRequired: true }
  };
  const result = await executeWithAccounting(job, renderNativeImage);
  const state = loadState();
  if (result?.billing) appendUsage(state, { jobId: job.jobId, rendererId: "image_media_renderer", createdAt: new Date().toISOString(), ...result.billing });
  saveState(state);
  return result;
}
function recordImprovement(failure) {
  const improvements = readJson(IMPROVEMENTS_FILE, []);
  const item = { id: `imp-${Date.now()}`, source: failure?.reason || "unknown_failure", suggestion: failure?.suggestion || "inspect failed renderer job and add a reusable template/test", status: "proposed", createdAt: new Date().toISOString(), activation: "requires_test_and_quality_gate" };
  improvements.push(item);
  writeJson(IMPROVEMENTS_FILE, improvements.slice(-500));
  const state = loadState();
  state.selfDevelopment.pendingImprovements = improvements.filter(x => x.status === "proposed").length;
  saveState(state);
  return item;
}
function status() {
  const state = loadState();
  return { ...state, library: inspectLibrary(), gpuLifecycle: gpuLifecycle.status(), costModel: costMeter.config(), selfDevelopment: { ...state.selfDevelopment } };
}
module.exports = { createRuntimeState, inspectLibrary, queue, execute, executeQueued, renderImage, recordImprovement, status, STATE_FILE, IMPROVEMENTS_FILE };
