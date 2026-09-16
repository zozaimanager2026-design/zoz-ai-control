const { createMemoryStore } = require("../zoz-memory");

(async () => {
  const memory = createMemoryStore();
  await memory.init();
  const snapshot = await memory.load();
  let repaired = 0;
  for (const item of snapshot.content || []) {
    if (item.goalKey !== "youtube_growth") continue;
    const errorText = String(item.renderError || "").toLowerCase();
    const legacyFailure = errorText.includes("42px") || (errorText.includes("font-size") && errorText.includes("expected integer"));
    const legacyPending = Boolean(item.renderProjectId) && !item.videoUrl;
    if (item.rendererVersion === 3 && !legacyFailure && !legacyPending) continue;
    await memory.remember("content", {
      ...item,
      rendererVersion: 3,
      ...(legacyFailure || legacyPending ? {
        status: "planned",
        renderProjectId: null,
        renderStatus: legacyFailure ? "legacy_renderer_error_reset" : "legacy_project_discarded",
        renderRetryCount: 0,
        renderError: null,
        retryAt: new Date().toISOString(),
        retryExhausted: false
      } : {})
    });
    if (legacyFailure || legacyPending) repaired += 1;
  }
  console.log(`[ZOZ media state repair] renderer v3 active; legacy media states reset: ${repaired}`);
})().catch((error) => {
  console.error("[ZOZ media state repair] failed", error?.message || error);
  process.exitCode = 1;
});
