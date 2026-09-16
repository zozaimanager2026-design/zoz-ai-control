const { createMemoryStore } = require("../zoz-memory");

(async () => {
  const memory = createMemoryStore();
  await memory.init();
  const snapshot = await memory.load();
  let repaired = 0;
  for (const item of snapshot.content || []) {
    if (item.goalKey !== "youtube_growth") continue;
    if (item.rendererVersion === 3) continue;
    const legacyPending = Boolean(item.renderProjectId) && !item.videoUrl;
    await memory.remember("content", {
      ...item,
      rendererVersion: 3,
      ...(legacyPending ? {
        status: "planned",
        renderProjectId: null,
        renderStatus: "legacy_project_discarded",
        renderRetryCount: 0,
        renderError: null,
        retryAt: new Date().toISOString()
      } : {})
    });
    if (legacyPending) repaired += 1;
  }
  console.log(`[ZOZ media state repair] renderer v3 active; legacy pending projects discarded: ${repaired}`);
})().catch((error) => {
  console.error("[ZOZ media state repair] failed", error?.message || error);
  process.exitCode = 1;
});
