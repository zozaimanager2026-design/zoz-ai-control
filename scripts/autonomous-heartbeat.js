const { runAutonomousRuntime } = require("../autonomous-runtime");
require("../server");

const INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.ZOZ_AUTONOMY_INTERVAL_MS || 15 * 60 * 1000));
let running = false;

async function heartbeat(trigger = "scheduled") {
  if (running) return;
  running = true;
  try {
    const result = await runAutonomousRuntime(trigger);
    const summary = {
      autonomous: result.autonomous,
      durableMemory: result.durableMemory,
      blockers: result.blockers?.map((item) => item.id) || [],
      nextAction: result.reconciliation?.nextAction || null,
      at: new Date().toISOString()
    };
    console.log("[ZOZ autonomous heartbeat]", JSON.stringify(summary));
  } catch (error) {
    console.error("[ZOZ autonomous heartbeat] failed", error?.message || error);
  } finally {
    running = false;
  }
}

setTimeout(() => heartbeat("startup"), 5000);
setInterval(() => heartbeat("scheduled"), INTERVAL_MS);

console.log(`[ZOZ autonomous heartbeat] enabled every ${INTERVAL_MS}ms`);
