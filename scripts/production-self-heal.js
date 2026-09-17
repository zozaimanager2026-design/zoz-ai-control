const { createStore, createTask, runCycle } = require("../execution-engine");
const { dispatchExecutableTasks } = require("../execution-renderer-bridge");

const TITLE = "ZOZ AI Client Brand Case Study — NEXORA Home";
const DESCRIPTION = "Create a professional client-facing portfolio case study using the approved ZOZ visual direction. Concept/Demo asset only.";

async function main() {
  const store = createStore();
  await store.init();
  const state = await store.load();

  let task = state.tasks.find((item) => item.title === TITLE && !["blocked", "approval_required"].includes(item.status));
  if (!task) {
    task = createTask(state, {
      title: TITLE,
      description: DESCRIPTION,
      serviceId: "portfolio_case_study",
      source: "production_self_heal",
      clientRef: "NEXORA_HOME_CONCEPT"
    });
  }

  // Move deterministically to the renderer handoff without bypassing safety gates.
  for (let i = 0; i < 3 && task.stage !== "execute"; i += 1) runCycle(state);
  const rendererResults = await dispatchExecutableTasks(state);

  // Advance post-render stages so a successful artifact reaches delivery/follow-up.
  for (let i = 0; i < 4 && task.status === "in_progress"; i += 1) runCycle(state);
  await store.save(state);

  const result = {
    ok: task.status !== "blocked" && task.status !== "approval_required",
    taskId: task.id,
    status: task.status,
    stage: task.stage,
    executionMode: task.executionMode || task.plan?.toolRouting?.executionMode || null,
    rendererResults,
    executionResult: task.executionResult || null,
    durable: store.durable
  };
  console.log("[ZOZ production self-heal]", JSON.stringify(result));
  if (!result.ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[ZOZ production self-heal] failed", error?.message || error);
  process.exitCode = 1;
});
