const { createMemoryStore } = require("./zoz-memory");
const { runMediaProductionAgent } = require("./media-production");

const INTERVAL_MS = Math.max(15000, Number(process.env.ZOZ_RENDERER_INTERVAL_MS || 30000));
let running = false;

async function cycle(trigger = "scheduled") {
  if (running) return;
  running = true;
  try {
    const memory = createMemoryStore();
    await memory.init();
    const result = await runMediaProductionAgent(memory);
    console.log("[ZOZ video renderer worker]", JSON.stringify({
      trigger,
      stage: result.stage || null,
      ok: result.ok,
      contentId: result.contentId || null,
      projectId: result.projectId || null,
      videoUrl: result.videoUrl || null,
      reason: result.reason || null,
      at: new Date().toISOString()
    }));
  } catch (error) {
    console.error("[ZOZ video renderer worker] cycle failed", error?.message || error);
  } finally {
    running = false;
  }
}

setTimeout(() => cycle("startup"), 3000);
setInterval(() => cycle("scheduled"), INTERVAL_MS);
console.log(`[ZOZ video renderer worker] enabled every ${INTERVAL_MS}ms`);
