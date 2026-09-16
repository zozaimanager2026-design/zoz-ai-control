const assert = require("assert");
const { SERVICES, getService, listServices, fallbackTools } = require("./digital-business-services");
const { buildPlan, createInitialState, createTask, advanceSafeTask, scoreOpportunity } = require("./execution-engine");

assert(Object.keys(SERVICES).length >= 7, "service catalog should contain digital business services");
for (const [id, service] of Object.entries(SERVICES)) {
  assert(service.label && service.skills?.length && service.primaryTools?.length && service.deliverables?.length, `${id} service is incomplete`);
  assert.strictEqual(getService(id).label, service.label);
}
assert.strictEqual(listServices().length, Object.keys(SERVICES).length);
assert.deepStrictEqual(fallbackTools("websites", ["vercel"]), ["github"]);
assert.deepStrictEqual(fallbackTools("unknown", ["vercel"]), []);

const plan = buildPlan({ serviceId: "content", title: "YouTube content package", description: "script and video" });
assert.strictEqual(plan.serviceId, "content");
assert(plan.skills.includes("media"));
assert(plan.deliverables.includes("video"));
assert(plan.tools.includes("media_tools"));

const state = createInitialState();
const safeTask = createTask(state, { serviceId: "content", title: "Create a YouTube video", description: "script, thumbnail and video" });
assert.strictEqual(safeTask.humanApprovalRequired, false);
assert.strictEqual(advanceSafeTask(state, safeTask).executed, true);

const financialTask = createTask(state, { serviceId: "digital_services", title: "شراء اشتراك", description: "purchase a paid subscription" });
assert.strictEqual(financialTask.humanApprovalRequired, true);
assert.strictEqual(advanceSafeTask(state, financialTask).reason, "financial_approval_required");

const opportunity = scoreOpportunity({ serviceId: "websites", requirementCompleteness: 90, budgetFit: 80, competition: 30, risk: 10 });
assert.strictEqual(opportunity.serviceId, "websites");
assert(opportunity.ready === true);

console.log("digital business execution tests: PASS");
