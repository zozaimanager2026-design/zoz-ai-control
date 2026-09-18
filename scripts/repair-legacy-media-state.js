const { createMemoryStore } = require("../zoz-memory");

const RENDERER_SCHEMA_VERSION = 5;

(async () => {
  const memory = createMemoryStore();
  await memory.init();
  const snapshot = await memory.load();
  let repaired = 0;
  for (const item of snapshot.content || []) {
    if (item.goalKey !== "youtube_growth") continue;
    const errorText = String(item.renderError || "").toLowerCase();
    const legacyFailure = errorText.includes("42px") || (errorText.includes("font-size") && errorText.includes("expected integer"));
    const legacyPending = Boolean(item.renderProjectId) && !item.videoUrl && item.rendererMigrationVersion !== RENDERER_SCHEMA_VERSION;
    const needsVersionMigration = item.rendererMigrationVersion !== RENDERER_SCHEMA_VERSION && (legacyFailure || legacyPending || item.rendererVersion !== RENDERER_SCHEMA_VERSION);
    if (!needsVersionMigration) continue;
    await memory.remember("content", {
      ...item,
      rendererVersion: RENDERER_SCHEMA_VERSION,
      rendererMigrationVersion: RENDERER_SCHEMA_VERSION,
      ...(legacyFailure || legacyPending ? {
        status: "planned",
        renderProjectId: null,
        videoUrl: null,
        renderStatus: legacyFailure ? "legacy_renderer_error_reset_v5" : "legacy_project_discarded_v5",
        renderRetryCount: 0,
        renderError: null,
        retryAt: new Date().toISOString(),
        retryExhausted: false
      } : {})
    });
    repaired += 1;
  }
  console.log(`[ZOZ media state repair] renderer v${RENDERER_SCHEMA_VERSION} active; legacy media states migrated: ${repaired}`);
})().catch((error) => {
  console.warn("[ZOZ media state repair] unavailable during startup; continuing:", error?.message || error);
});

// v5 migration is intentionally idempotent so restarts cannot regress media schema.
