const { runAutonomousRuntime } = require("../autonomous-runtime");
require("../server");

const INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.ZOZ_AUTONOMY_INTERVAL_MS || 15 * 60 * 1000));
let running = false;

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
      at: new Date().toISOString()
    };
    console.log("[ZOZ autonomous heartbeat v3]", JSON.stringify(summary));
  } catch (error) {
    console.error("[ZOZ autonomous heartbeat] failed", error?.message || error);
  } finally {
    running = false;
  }
}

setTimeout(() => heartbeat("startup"), 5000);
setInterval(() => heartbeat("scheduled"), INTERVAL_MS);

console.log(`[ZOZ autonomous heartbeat v3] enabled every ${INTERVAL_MS}ms`);
