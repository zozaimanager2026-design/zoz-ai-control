const { executeAutonomousAgents } = require("./channel-agents");

function buildPublishingPlan(memory) {
  const planned = (memory.content || []).filter(x => x.goalKey === "youtube_growth" && ["draft", "ready"].includes(x.status));
  return planned.map(item => ({
    contentId: item.id,
    status: item.status,
    title: item.title || "ZOZ AI YouTube content",
    publishReady: Boolean(item.videoUrl),
    blocker: item.videoUrl ? null : "video_asset_required"
  }));
}

async function runPublishingPlanner(memoryStore) {
  const memory = await memoryStore.load();
  const plan = buildPublishingPlan(memory);
  await memoryStore.recordRun({
    id: `publish_plan_${Date.now()}`,
    mode: "publishing_planner",
    plan,
    completedAt: new Date().toISOString()
  });
  return { ok: true, plan };
}

module.exports = { buildPublishingPlan, runPublishingPlanner };
