// ZOZ Kaggle Generation Manager — durable submit/monitor/ingest pipeline.
// Tracks Kaggle execution jobs in PostgreSQL and ingests image outputs into the ZOZ Asset Store.
// Financial actions remain outside this pipeline and still require human approval.

const { Pool } = require("pg");
const kaggle = require("./kaggle-control");
const assetStore = require("./asset-store");

const DATABASE_URL = process.env.DATABASE_URL || process.env.ZOZ_DATABASE_URL || "";
const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 })
  : null;

const DEFAULT_POLL_MS = Math.max(60 * 1000, Number(process.env.ZOZ_KAGGLE_MONITOR_INTERVAL_MS || 2 * 60 * 1000));
const MAX_ERROR_TEXT = 2000;

function safeText(value, max = MAX_ERROR_TEXT) {
  return String(value || "").slice(0, max);
}

function kernelParts(kernel) {
  const parts = String(kernel || process.env.ZOZ_KAGGLE_KERNEL || "").trim().split("/", 2);
  if (parts.length !== 2) throw new Error("kaggle_kernel_must_be_owner_slash_slug");
  return parts;
}

function extractStatusValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.length < 80) {
    const normalized = value.trim().toLowerCase();
    if (/^(queued|running|pending|processing|complete|completed|success|succeeded|finished|error|failed|failure|canceled|cancelled|aborted|stopped|timeout|timed_out)$/.test(normalized)) return normalized;
  }
  if (typeof value === "object") {
    for (const key of ["status", "state", "runStatus", "executionStatus", "executionState", "phase"]) {
      const candidate = extractStatusValue(value[key]);
      if (candidate) return candidate;
    }
    for (const key of ["latestRun", "run", "execution", "result", "data"]) {
      const candidate = extractStatusValue(value[key]);
      if (candidate) return candidate;
    }
  }
  return null;
}

function normalizeStatus(payload) {
  const status = extractStatusValue(payload?.result || payload);
  if (status) return status;
  const raw = JSON.stringify(payload || {}).toLowerCase();
  if (/\b(failed|failure|error|cancelled|canceled|aborted|timed_out|timeout)\b/.test(raw)) return "failed";
  if (/\b(complete|completed|success|succeeded|finished)\b/.test(raw)) return "completed";
  if (/\b(running|processing|queued|pending)\b/.test(raw)) return "running";
  return "unknown";
}

function isTerminalFailure(status) {
  return ["error", "failed", "failure", "canceled", "cancelled", "aborted", "timeout", "timed_out", "stopped"].includes(status);
}

function isTerminalSuccess(status) {
  return ["complete", "completed", "success", "succeeded", "finished"].includes(status);
}

function outputFiles(body) {
  const candidates = [
    body?.files,
    body?.outputFiles,
    body?.result?.files,
    body?.result?.outputFiles,
    body?.data?.files,
    body?.data?.outputFiles
  ];
  for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
  return [];
}

function fileNameOf(file) {
  return String(file?.fileName || file?.filename || file?.name || file?.file_path || file?.filePath || "").trim();
}

function isImageFile(file) {
  return /\.(png|jpe?g|webp|gif)$/i.test(fileNameOf(file));
}

async function ensureTable() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zoz_kaggle_jobs (
      id TEXT PRIMARY KEY,
      kernel TEXT NOT NULL,
      version_number TEXT,
      ref TEXT,
      title TEXT,
      prompt TEXT,
      requested_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL,
      kaggle_status TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      ingested_at TIMESTAMPTZ,
      asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      output_meta JSONB,
      error TEXT
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_zoz_kaggle_jobs_status_updated ON zoz_kaggle_jobs(status, updated_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_zoz_kaggle_jobs_kernel_version ON zoz_kaggle_jobs(kernel, version_number)");
  return true;
}

async function insertJob(job) {
  if (!pool) return null;
  await ensureTable();
  await pool.query(
    `INSERT INTO zoz_kaggle_jobs
      (id, kernel, version_number, ref, title, prompt, requested_outputs, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [
      job.id,
      job.kernel,
      job.versionNumber == null ? null : String(job.versionNumber),
      safeText(job.ref, 500),
      safeText(job.title, 500),
      safeText(job.prompt, 4000),
      JSON.stringify(Array.isArray(job.requestedOutputs) ? job.requestedOutputs.map(safeText) : []),
      "submitted"
    ]
  );
  return job;
}

async function submitImageGeneration({ text, title, prompt = "", requestedOutputs = [], ...options } = {}) {
  if (!kaggle.configured()) return { ok: false, status: 503, error: "kaggle_not_configured" };
  const id = "kaggle_job_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const newTitle = title || ("ZOZ AI Kaggle Renderer " + Date.now());
  const pushed = await kaggle.executeKernelCode(text, {
    ...options,
    newTitle,
    run: true
  });
  if (!pushed.ok) return pushed;
  const body = pushed.body || {};
  const job = {
    id,
    kernel: String(options.kernel || process.env.ZOZ_KAGGLE_KERNEL || "").trim(),
    versionNumber: body.versionNumber ?? body.versionNumberNullable ?? null,
    ref: body.ref || null,
    title: newTitle,
    prompt,
    requestedOutputs,
    createdAt: new Date().toISOString()
  };
  try {
    await insertJob(job);
  } catch (error) {
    // Kaggle execution is already accepted; keep the failure explicit rather than replaying it.
    return { ok: true, status: pushed.status || 200, body, job, tracking: { ok: false, error: "job_persistence_failed" } };
  }
  return { ok: true, status: pushed.status || 200, body, job, tracking: { ok: true, durable: Boolean(pool) } };
}

async function listActiveJobs(limit = 20) {
  if (!pool) return [];
  await ensureTable();
  const result = await pool.query(
    "SELECT * FROM zoz_kaggle_jobs WHERE status IN ('submitted','running','completed') AND ingested_at IS NULL ORDER BY submitted_at ASC LIMIT $1",
    [Math.max(1, Math.min(50, Number(limit) || 20))]
  );
  return result.rows;
}

async function updateJob(id, fields) {
  if (!pool) return;
  const allowed = new Set(["status", "kaggle_status", "updated_at", "completed_at", "ingested_at", "asset_ids", "output_meta", "error"]);
  const pairs = [];
  const values = [];
  for (const [key, value] of Object.entries(fields || {})) {
    if (!allowed.has(key)) continue;
    values.push(value instanceof Date ? value : (Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : value));
    pairs.push(`${key}=$${values.length}${key === "asset_ids" || key === "output_meta" ? "::jsonb" : ""}`);
  }
  if (!pairs.length) return;
  values.push(id);
  pairs.push("updated_at=NOW()");
  await pool.query(`UPDATE zoz_kaggle_jobs SET ${pairs.join(", ")} WHERE id=$${values.length}`, values);
}

async function downloadOutputFile(file, kernel, token = "") {
  const url = file?.url || file?.downloadUrl || file?.download_url;
  if (url) {
    const response = await fetch(String(url));
    if (!response.ok) throw new Error("kaggle_signed_download_failed:" + response.status);
    return Buffer.from(await response.arrayBuffer());
  }
  const [owner, slug] = kernelParts(kernel);
  const name = fileNameOf(file);
  if (!name || !token) throw new Error("kaggle_output_download_unavailable");
  const apiBase = String(process.env.ZOZ_KAGGLE_API_BASE || "https://www.kaggle.com/api/v1").replace(/\/$/, "");
  const encodedName = name.split("/").map(encodeURIComponent).join("/");
  const candidates = [
    apiBase + "/kernels/output/download/" + encodeURIComponent(owner) + "/" + encodeURIComponent(slug) + "/" + encodedName,
    apiBase + "/kernels/output/" + encodeURIComponent(owner) + "/" + encodeURIComponent(slug) + "/" + encodedName
  ];
  let lastStatus = null;
  for (const path of candidates) {
    const response = await fetch(path, { headers: { Authorization: "Bearer " + token } });
    lastStatus = response.status;
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("kaggle_output_download_failed:" + lastStatus);
}

async function ingestCompletedJob(job) {
  const claimed = await pool.query(
    "UPDATE zoz_kaggle_jobs SET status='ingesting', updated_at=NOW() WHERE id=$1 AND status='completed' AND ingested_at IS NULL RETURNING *",
    [job.id]
  );
  if (!claimed.rows[0]) return { ok: true, skipped: true, reason: "already_ingested_or_claimed" };
  const locked = claimed.rows[0];

  try {
    const result = await kaggle.kernelOutput();
    if (!result.ok) throw new Error("kaggle_output_failed:" + result.status);
    const files = outputFiles(result.body || {}).filter(isImageFile);
    if (!files.length) {
      await updateJob(job.id, { status: "completed", output_meta: { keys: Object.keys(result.body || {}), files: [] }, error: "kaggle_output_image_not_found" });
      return { ok: false, error: "kaggle_output_image_not_found" };
    }

    const requested = Array.isArray(locked.requested_outputs) ? locked.requested_outputs.map(String) : [];
    const ordered = requested.length
      ? [...files].sort((a, b) => (requested.findIndex(x => fileNameOf(a).endsWith(x)) + 1 || 999) - (requested.findIndex(x => fileNameOf(b).endsWith(x)) + 1 || 999))
      : files;
    const selected = ordered.slice(0, 10);
    const token = String(process.env.KAGGLE_API_TOKEN || "").trim();
    const assetIds = [];

    for (const file of selected) {
      const bytes = await downloadOutputFile(file, locked.kernel, token);
      if (!bytes.length) continue;
      const filename = fileNameOf(file).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
      const asset = await assetStore.persistImage({
        id: "img_kaggle_" + job.id + "_" + filename,
        imageBase64: "data:" + (/\.jpe?g$/i.test(filename) ? "image/jpeg" : /\.webp$/i.test(filename) ? "image/webp" : /\.gif$/i.test(filename) ? "image/gif" : "image/png") + ";base64," + bytes.toString("base64"),
        prompt: locked.prompt || "ZOZ AI Kaggle image generation",
        provider: "kaggle"
      });
      if (!asset.ok) throw new Error("asset_persist_failed:" + filename);
      const loaded = await assetStore.getImage(asset.id);
      if (!loaded) throw new Error("asset_verify_failed:" + filename);
      assetIds.push(asset.id);
    }

    if (!assetIds.length) throw new Error("kaggle_no_assets_ingested");
    await updateJob(job.id, { status: "ingested", ingested_at: new Date(), asset_ids: assetIds, output_meta: { files: selected.map(fileNameOf), assets: assetIds } });
    return { ok: true, status: "ingested", assetIds };
  } catch (error) {
    await updateJob(job.id, { status: "completed", error: safeText(error.message) });
    return { ok: false, error: safeText(error.message) };
  }
}

async function monitorOnce() {
  if (!pool || !kaggle.configured()) return { ok: true, skipped: true, reason: "monitoring_not_configured" };
  const jobs = await listActiveJobs(20);
  const results = [];
  for (const job of jobs) {
    try {
      const statusResult = await kaggle.kernelStatus();
      const normalized = normalizeStatus(statusResult);
      const patch = { kaggle_status: normalized };
      if (normalized === "running" || normalized === "queued" || normalized === "processing" || normalized === "pending") patch.status = "running";
      if (isTerminalFailure(normalized)) {
        patch.status = "failed";
        patch.error = safeText(JSON.stringify(statusResult.result || statusResult));
        await updateJob(job.id, patch);
        results.push({ id: job.id, status: "failed" });
        continue;
      }
      if (isTerminalSuccess(normalized)) {
        patch.status = "completed";
        patch.completed_at = new Date();
        await updateJob(job.id, patch);
        const ingest = await ingestCompletedJob({ ...job, status: "completed" });
        results.push({ id: job.id, status: ingest.ok ? "ingested" : "completed_with_error", ingest });
        continue;
      }
      patch.status = job.status === "submitted" ? "submitted" : "running";
      await updateJob(job.id, patch);
      results.push({ id: job.id, status: patch.status, kaggleStatus: normalized });
    } catch (error) {
      await updateJob(job.id, { error: safeText(error.message) });
      results.push({ id: job.id, status: "monitor_error" });
    }
  }
  return { ok: true, jobs: results, nextPollMs: DEFAULT_POLL_MS };
}

let timer = null;
function startMonitoring() {
  if (timer || !pool || !kaggle.configured()) return false;
  const run = () => monitorOnce().catch(() => null);
  setTimeout(run, 15000);
  timer = setInterval(run, DEFAULT_POLL_MS);
  return true;
}

module.exports = { submitImageGeneration, monitorOnce, startMonitoring, listActiveJobs, normalizeStatus, ensureTable };
