const { runAutonomousRuntime } = require("../autonomous-runtime");
require("./vercel-token-route");
const app = require("../server");
const rendererRuntime = require("../renderers/runtime");

const INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.ZOZ_AUTONOMY_INTERVAL_MS || 15 * 60 * 1000));
const MAX_RENDERER_CONCURRENCY = Math.max(1, Math.min(2, Number(process.env.ZOZ_RENDERER_MAX_CONCURRENCY || 1)));
const RENDERER_SECRET = process.env.RENDERER_INTERNAL_SECRET || process.env.CRON_SECRET || "";
let running = false;
let rendererRunning = 0;

function authorizeRenderer(req, res) {
  if (!RENDERER_SECRET) return res.status(503).json({ ok: false, error: "renderer_secret_not_configured" });
  const actual = String(req.get("authorization") || "");
  if (actual !== `Bearer ${RENDERER_SECRET}`) return res.status(401).json({ ok: false, error: "renderer_unauthorized" });
  return null;
}

// Integrated Renderer layer: the existing Railway service remains the Core and now
// exposes the independent renderer through the same process. Heavy work is queued and
// concurrency is deliberately capped so renderer load cannot consume the whole Core.
app.get("/api/renderer/health", (req, res) => {
  const denied = authorizeRenderer(req, res);
  if (denied) return;
  res.json({ ok: true, service: "zoz-integrated-renderer", status: "ready", maxConcurrency: MAX_RENDERER_CONCURRENCY, active: rendererRunning });
});
app.get("/api/renderer/status", (req, res) => {
  const denied = authorizeRenderer(req, res);
  if (denied) return;
  res.json(rendererRuntime.status());
});
app.post("/api/renderer/inspect", (req, res) => {
  const denied = authorizeRenderer(req, res);
  if (denied) return;
  res.json(rendererRuntime.inspectLibrary());
});
app.post("/api/renderer/queue", (req, res) => {
  const denied = authorizeRenderer(req, res);
  if (denied) return;
  const result = rendererRuntime.queue(req.body || {});
  if (!result.ok) return res.status(400).json(result);
  res.status(202).json({ ...result, status: "queued", renderer: "integrated" });
});
app.post("/api/renderer/execute", async (req, res) => {
  const denied = authorizeRenderer(req, res);
  if (denied) return;
  if (rendererRunning >= MAX_RENDERER_CONCURRENCY) return res.status(429).json({ ok: false, error: "renderer_capacity_reached", retryable: true });
  const job = rendererRuntime.queue(req.body || {});
  if (!job.ok) return res.status(400).json(job);
  rendererRunning += 1;
  try {
    const result = await rendererRuntime.execute(job);
    res.status(result?.ok === false ? 422 : 200).json({ ...result, jobId: job.jobId, renderer: "integrated" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "renderer_execution_failed" });
  } finally {
    rendererRunning = Math.max(0, rendererRunning - 1);
  }
});
app.post("/api/renderer/improve", (req, res) => {
  const denied = authorizeRenderer(req, res);
  if (denied) return;
  res.status(201).json(rendererRuntime.recordImprovement(req.body || {}));
});

async function heartbeat(trigger = "scheduled") {
  if (running) return;
  running = true;
  try {
    const result = await runAutonomousRuntime(trigger);
    const youtube = result.agents?.find((item) => item.agent === "youtube")?.result || null;
    const summary = {
      autonomous: result.autonomous,
      durableMemory: result.durableMemory,
      blockers: result.blockers?.map((item) => item.id) || [],
      nextAction: result.reconciliation?.nextAction || null,
      media: result.media ? {
        stage: result.media.stage || null,
        ok: result.media.ok,
        reason: result.media.reason || null,
        status: result.media.status || null,
        contentId: result.media.contentId || null,
        projectId: result.media.projectId || null,
        videoUrl: result.media.videoUrl || null,
        publicationStage: result.media.publication?.stage || null,
        videoId: result.media.publication?.videoId || null,
        requestId: result.media.publication?.requestId || null,
        url: result.media.publication?.url || null
      } : null,
      youtube: youtube ? {
        stage: youtube.stage || null,
        ok: youtube.ok,
        contentId: youtube.contentId || null,
        adapter: youtube.adapter || null,
        publishRequestId: youtube.publishRequestId || null
      } : null,
      renderer: { integrated: true, active: rendererRunning, maxConcurrency: MAX_RENDERER_CONCURRENCY },
      at: new Date().toISOString()
    };
    console.log("[ZOZ autonomous heartbeat v3]", JSON.stringify(summary));
  } catch (error) {
    console.error("[ZOZ autonomous heartbeat] failed", error?.message || error);
  } finally {
    running = false;
  }
}

// On startup, repair any legacy video state before the first autonomous cycle.
setTimeout(() => heartbeat("startup"), 5000);
setInterval(() => heartbeat("scheduled"), INTERVAL_MS);

console.log(`[ZOZ autonomous heartbeat v3] enabled every ${INTERVAL_MS}ms`);
console.log(`[ZOZ integrated renderer] enabled with max concurrency ${MAX_RENDERER_CONCURRENCY}`);
