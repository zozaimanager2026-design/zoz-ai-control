const assert = require("assert");
const fs = require("fs");
const runtime = require("./runtime");

const tasks = [
  { id: `local-exec-test-${Date.now()}`, serviceId: "brand_identity", title: "ZOZ AI brand production test", description: "Create a lightweight brand identity package", plan: { skills: ["brand_identity"], deliverables: ["logo", "visual_identity", "brand_guidelines", "social_assets", "final_package"] }, financial: false, humanApprovalRequired: false },
  { id: `portfolio-test-${Date.now()}`, serviceId: "portfolio_case_study", title: "ZOZ AI Client Brand Case Study — NEXORA Home", description: "Create a professional client-facing portfolio case study using the approved ZOZ visual direction", plan: { skills: ["portfolio_case_study"], deliverables: ["client_portfolio", "brand_case_study", "presentation", "brand_system", "content_system", "qa_package"] }, financial: false, humanApprovalRequired: false }
];

Promise.all(tasks.map(async task => {
  const job = runtime.queue(task);
  assert.strictEqual(job.ok, true);
  const result = await runtime.execute(job);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.executionMode, "local-production");
  assert(result.artifact && result.artifact.id, "A production manifest must be produced");
  assert(Array.isArray(result.files) && result.files.length >= 2, "Real production files must be produced");
  for (const file of result.files) assert(fs.existsSync(file.path), `Artifact missing: ${file.path}`);
})).then(() => {
  const status = runtime.status();
  assert(status.completed >= 2, "Renderer must record both completed production jobs");
  console.log("local-executors.test.js: OK");
});