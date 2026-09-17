// ZOZ AI execution -> renderer bridge.
// Only non-financial tasks at the explicit execute stage are dispatched.
// Financial tasks remain behind the existing human approval gate.
const rendererRuntime = require("./renderers/runtime");

async function dispatchExecutableTasks(state) {
  const results = [];
  for (const task of state.tasks || []) {
    if (task.status !== "in_progress" || task.stage !== "execute") continue;
    if (task.financial || task.humanApprovalRequired) {
      results.push({ taskId: task.id, executed: false, reason: "financial_approval_required" });
      continue;
    }
    const job = rendererRuntime.queue({
      id: task.id,
      serviceId: task.serviceId,
      title: task.title,
      description: task.description,
      plan: task.plan,
      financial: false,
      humanApprovalRequired: false
    });
    if (!job.ok) {
      task.status = "blocked";
      task.executionResult = job;
      results.push({ taskId: task.id, executed: false, reason: job.reason || "renderer_queue_failed" });
      continue;
    }
    const result = await rendererRuntime.execute(job);
    task.executionResult = result;
    task.updatedAt = new Date().toISOString();
    if (result?.ok === false) {
      task.status = "blocked";
      task.executionBlockReason = result.reason || "renderer_execution_failed";
    } else {
      task.stage = "quality_check";
      task.status = "in_progress";
      task.executionMode = result.executionMode || "renderer";
    }
    results.push({ taskId: task.id, executed: result?.ok !== false, executionMode: result?.executionMode || null, artifact: result?.artifact || null, reason: result?.reason || null });
  }
  return results;
}

module.exports = { dispatchExecutableTasks };
