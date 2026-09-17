// ZOZ AI Independent Renderer Runtime
// Runs the reusable digital-work library without requiring ChatGPT, Vercel, Railway,
// or a specific external application to remain available.
// External services are optional adapters; the renderer core remains local and testable.
const fs = require("fs");
const path = require("path");
const { RENDERERS, resolveRenderer, buildRendererJob, getRenderPolicy } = require("./index");
const { createDefaultAdapters } = require("./local-executors");

const ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(ROOT, ".zoz-renderer");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const IMPROVEMENTS_FILE = path.join(STATE_DIR, "improvements.json");

function ensureStateDir() { fs.mkdirSync(STATE_DIR, { recursive: true }); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writeJson(file, value) { ensureStateDir(); const temp = `${file}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2)); fs.renameSync(temp, file); }
function createRuntimeState() { return { version: 2, status: "ready", rendererCount: Object.keys(RENDERERS).length, jobs: [], completed: 0, failed: 0, lastRunAt: null, selfDevelopment: { enabled: true, mode: "safe", pendingImprovements: 0 }, financialApprovalRequired: true }; }
function loadState() { return readJson(STATE_FILE, createRuntimeState()); }
function saveJsonState(state) { writeJson(STATE_FILE, state); }
function saveState(state) { state.lastRunAt = new Date().toISOString(); state.rendererCount = Object.keys(RENDERERS).length; saveJsonState(state); }
function inspectLibrary() { const failures = []; for (const [section, renderer] of Object.entries(RENDERERS)) if (!renderer.id || !renderer.queue || !Array.isArray(renderer.capabilities)) failures.push({ section, reason: "invalid_renderer_contract" }); return { ok: failures.length === 0, rendererCount: Object.keys(RENDERERS).length, failures, policy: getRenderPolicy(), localExecution: true }; }
function queue(task) { const job = buildRendererJob(task); if (!job.ok) return job; const state = loadState(); const queued = { ...job, createdAt: new Date().toISOString(), status: "queued" }; state.jobs.push(queued); if (state.jobs.length > 500) state.jobs = state.jobs.slice(-500); saveState(state); return queued; }
function execute(job, adapters = {}) {
  const state = loadState();
  const renderer = resolveRenderer({ serviceId: job.section, skills: job.input?.skills || [], deliverables: job.input?.deliverables || [] });
  if (!renderer) return Promise.resolve({ ok: false, reason: "renderer_not_registered" });
  if (job.approval?.financial && job.approval?.humanApprovalRequired !== false) return Promise.resolve({ ok: false, status: "approval_required", reason: "financial_approval_required" });
  const registry = { ...createDefaultAdapters(), ...adapters };
  const adapter = registry[renderer.id];
  const result = typeof adapter === "function" ? adapter(job.input) : { ok: false, status: "blocked", reason: "external_adapter_required", rendererId: renderer.id };
  const finalResult = result && typeof result.then === "function" ? result : Promise.resolve(result);
  return finalResult.then(value => {
    const current = loadState();
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
function recordImprovement(failure) { const improvements = readJson(IMPROVEMENTS_FILE, []); const item = { id: `imp-${Date.now()}`, source: failure?.reason || "unknown_failure", suggestion: failure?.suggestion || "inspect failed renderer job and add a reusable template/test", status: "proposed", createdAt: new Date().toISOString(), activation: "requires_test_and_quality_gate" }; improvements.push(item); writeJson(IMPROVEMENTS_FILE, improvements.slice(-500)); const state = loadState(); state.selfDevelopment.pendingImprovements = improvements.filter(x => x.status === "proposed").length; saveState(state); return item; }
function status() { const state = loadState(); return { ...state, library: inspectLibrary(), selfDevelopment: { ...state.selfDevelopment } }; }
module.exports = { createRuntimeState, inspectLibrary, queue, execute, executeQueued, recordImprovement, status, STATE_FILE, IMPROVEMENTS_FILE };
