const assert = require("assert");
const { SERVICES, getService, listServices, fallbackTools } = require("./digital-business-services");
const { buildPlan, createInitialState, createTask, advanceSafeTask, scoreOpportunity, selectExecutionTools } = require("./execution-engine");

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
assert(plan.toolRouting.executionMode === "primary");
assert(plan.stages.includes("execute"));
assert(plan.stages.includes("quality_check"));

const fallback = selectExecutionTools(getService("websites"), { unavailableTools: ["github", "vercel"] });
assert.strictEqual(fallback.executionMode, "blocked");
assert.strictEqual(fallback.selectedTools.length, 0);
const explicitFallback = selectExecutionTools(getService("websites"), { availableTools: ["github"] });
assert.deepStrictEqual(explicitFallback.selectedTools, ["github"]);
assert.strictEqual(explicitFallback.executionMode, "primary");

const state = createInitialState();
const safeTask = createTask(state, { serviceId: "content", title: "Create a YouTube video", description: "script, thumbnail and video" });
assert.strictEqual(safeTask.humanApprovalRequired, false);
assert.strictEqual(advanceSafeTask(state, safeTask).executed, true);
assert.strictEqual(safeTask.stage, "prepare_assets");

const blockedTask = createTask(state, { serviceId: "websites", title: "Build website", description: "landing page", availableTools: [] });
assert.strictEqual(blockedTask.status, "blocked");
assert.strictEqual(advanceSafeTask(state, blockedTask).reason, "no_execution_tool_available");

const financialTask = createTask(state, { serviceId: "digital_services", title: "شراء اشتراك", description: "purchase a paid subscription" });
assert.strictEqual(financialTask.humanApprovalRequired, true);
assert.strictEqual(advanceSafeTask(state, financialTask).reason, "financial_approval_required");

const opportunity = scoreOpportunity({ serviceId: "websites", requirementCompleteness: 90, budgetFit: 80, competition: 30, risk: 10 });
assert.strictEqual(opportunity.serviceId, "websites");
assert(opportunity.ready === true);

console.log("digital business execution tests: PASS");
