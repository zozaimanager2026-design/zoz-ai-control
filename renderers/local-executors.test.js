const assert = require("assert");
const runtime = require("./runtime");

const task = {
  id: `local-exec-test-${Date.now()}`,
  serviceId: "brand_identity",
  title: "ZOZ AI brand production test",
  description: "Create a lightweight brand identity package",
  plan: { skills: ["brand_identity"], deliverables: ["logo", "visual_identity", "brand_guidelines", "social_assets", "final_package"] },
  financial: false,
  humanApprovalRequired: false
};

const job = runtime.queue(task);
assert.strictEqual(job.ok, true);
return runtime.execute(job).then(result => {
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.executionMode, "local-lightweight");
  assert(result.artifact && result.artifact.id, "A real local artifact must be produced");
  const status = runtime.status();
  assert(status.completed >= 1, "Renderer must record completion");
  console.log("local-executors.test.js: OK");
});
