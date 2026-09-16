const assert = require("assert");
const { RENDERERS, resolveRenderer, buildRendererJob } = require("./renderers");

assert(Object.keys(RENDERERS).length >= 8, "Every core ZOZ AI section must have an independent renderer");
assert(RENDERERS.media.queue !== RENDERERS.websites.queue, "Renderers must use isolated queues");
const media = resolveRenderer({ serviceId: "media", skills: ["media"], deliverables: ["video"] });
assert.strictEqual(media.id, "video_media_renderer");
const job = buildRendererJob({ id: "test-job", serviceId: "media", title: "test", description: "video", plan: { skills: ["media"], deliverables: ["video"] }, financial: false, humanApprovalRequired: false });
assert.strictEqual(job.ok, true);
assert.strictEqual(job.queue, "zoz.render.media");
console.log("renderer-registry.test.js: OK");
