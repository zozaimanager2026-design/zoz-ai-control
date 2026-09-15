const crypto = require("crypto");
const { createMemoryStore } = require("./zoz-memory");
const { createAutonomyCore } = require("./autonomy-core");
const { executeAutonomousAgents } = require("./channel-agents");

const now = () => new Date().toISOString();
const id = (p) => `${p}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

async function runAutonomousRuntime(trigger = "scheduled") {
  const memory = createMemoryStore();
  const memoryStatus = await memory.init();
  const core = createAutonomyCore(memory);
  const heartbeat = await core.heartbeat({ trigger });
  const agents = await executeAutonomousAgents(memory);
  const snapshot = await memory.load();
  const blockers = [];
  if (!memory.durable) blockers.push({ id: "durable_memory", priority: 1, reason: "DATABASE_URL_or_ZOZ_DATABASE_URL_missing" });
  if (agents.some(x => x.agent === "youtube" && x.result?.stage === "connection")) blockers.push({ id: "youtube_connection", priority: 1, reason: "YouTube connector is not configured for the server runtime" });
  if (agents.some(x => x.agent === "lead_generation" && x.result?.reason === "ZOZ_SEARCH_API_URL_and_ZOZ_SEARCH_API_KEY_missing")) blockers.push({ id: "lead_search_adapter", priority: 1, reason: "No server-side lead search adapter configured" });
  const run = await memory.recordRun({
    id: id("runtime"),
    mode: "autonomous_runtime",
    trigger,
    heartbeat,
    agents,
    blockers,
    completedAt: now()
  });
  return { ok: true, durableMemory: memory.durable, memoryStatus, heartbeat, agents, blockers, lastRun: run, snapshot };
}

async function getAutonomyStatus() {
  const memory = createMemoryStore();
  const memoryStatus = await memory.init();
  const snapshot = await memory.load();
  return {
    ok: true,
    durableMemory: memory.durable,
    memoryStatus,
    identity: snapshot.identity,
    goals: snapshot.goals,
    projects: snapshot.projects,
    opportunities: snapshot.opportunities.slice(-50),
    content: snapshot.content.slice(-50),
    channelState: snapshot.channelState,
    runs: snapshot.runs.slice(-20),
    updatedAt: snapshot.updatedAt
  };
}

module.exports = { runAutonomousRuntime, getAutonomyStatus };
