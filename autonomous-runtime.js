const crypto = require("crypto");
const { createMemoryStore } = require("./zoz-memory");
const { createAutonomyCore } = require("./autonomy-core");
const { executeAutonomousAgents } = require("./channel-agents");
const { runMediaProductionAgent } = require("./media-production");

const now = () => new Date().toISOString();
const id = (p) => `${p}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
function configured(name) { return Boolean(process.env[name]); }
function leadSearchConfigured() {
  if (process.env.ZOZ_DISABLE_BUILTIN_LEAD_SEARCH === "true") return configured("ZOZ_SEARCH_API_URL") && configured("ZOZ_SEARCH_API_KEY");
  return true;
}

async function reconcileExistingState(memory) {
  const snapshot = await memory.load();
  const integrations = {
    github: { configured: configured("GITHUB_TOKEN"), source: "runtime_env" },
    vercel: { configured: configured("VERCEL_TOKEN"), source: "runtime_env" },
    database: { configured: configured("DATABASE_URL") || configured("ZOZ_DATABASE_URL"), source: "runtime_env" },
    durableKv: { configured: configured("KV_REST_API_URL") || configured("UPSTASH_REDIS_REST_URL") || configured("ZOZ_KV_REST_API_URL"), source: "runtime_env" },
    youtube: { configured: configured("YOUTUBE_ACCESS_TOKEN") || configured("UPLOAD_POST_API_KEY"), source: configured("YOUTUBE_ACCESS_TOKEN") ? "youtube_api" : "upload_post" },
    aiAdapter: { configured: configured("ZOZ_AI_API_KEY") || configured("OPENAI_API_KEY"), source: "runtime_env" },
    leadSearch: { configured: leadSearchConfigured(), source: configured("ZOZ_SEARCH_API_URL") && configured("ZOZ_SEARCH_API_KEY") ? "configured_search_api" : "openstreetmap_overpass_builtin" },
    whatsapp: { configured: configured("WHATSAPP_ACCESS_TOKEN") || configured("PEACH_API_KEY"), source: "runtime_env" },
    uploadPost: { configured: configured("UPLOAD_POST_API_KEY"), source: "runtime_env" },
    mediaRenderer: { configured: configured("J2V_API_KEY") || configured("JSON2VIDEO_API_KEY"), source: "json2video" }
  };
  const blockers = [];
  if (!memory.durable) blockers.push({ id: "durable_memory", priority: 1, reason: "No durable memory backend is configured" });
  if (!integrations.youtube.configured) blockers.push({ id: "youtube_connection", priority: 1, reason: "YouTube server connector is not configured; direct YouTube API or Upload-Post is required" });
  if (!integrations.leadSearch.configured) blockers.push({ id: "lead_search_adapter", priority: 2, reason: "No server-side lead search adapter is configured" });
  let nextAction = "reconcile_integrations_and_execute_highest_value_safe_action";
  if (blockers.some(x => x.id === "durable_memory")) nextAction = "configure_durable_memory_backend";
  else if (blockers.some(x => x.id === "youtube_connection")) nextAction = "connect_youtube_server_runtime";
  else if (blockers.some(x => x.id === "lead_search_adapter")) nextAction = "connect_lead_search_adapter";
  await memory.setControlPlane({ lastReconciledAt: now(), sources: integrations, blockers, nextAction, knownState: { existingProjects: snapshot.projects.length, existingContacts: snapshot.contacts.length, existingOpportunities: snapshot.opportunities.length, existingContent: snapshot.content.length, previousRuns: snapshot.runs.length } });
  return { integrations, blockers, nextAction };
}

async function runAutonomousRuntime(trigger = "scheduled") {
  const memory = createMemoryStore();
  const memoryStatus = await memory.init();
  const reconciliation = await reconcileExistingState(memory);
  const core = createAutonomyCore(memory);
  const heartbeat = await core.heartbeat({ trigger });

  // Generate/plan channel work before media production so a new YouTube draft
  // can enter rendering during the same autonomous heartbeat.
  let agents;
  try {
    agents = await executeAutonomousAgents(memory);
  } catch (error) {
    agents = [{ agent: "runtime", result: { ok: false, stage: "agent_runtime_exception", reason: String(error?.message || error).slice(0, 300), retryable: true } }];
  }

  let media;
  try {
    media = await runMediaProductionAgent(memory);
  } catch (error) {
    media = { ok: false, stage: "media_runtime_exception", reason: String(error?.message || error).slice(0, 300), retryable: true };
  }

  const snapshot = await memory.load();
  const blockers = [...reconciliation.blockers];
  const leadFailure = agents.find(x => x.agent === "lead_generation" && !x.result?.ok);
  if (leadFailure && !blockers.some(x => x.id === "lead_search_adapter")) blockers.push({ id: "lead_search_adapter", priority: 2, reason: leadFailure.result?.reason || "Lead discovery adapter failed during the autonomous run", diagnostic: { stage: leadFailure.result?.stage || null, source: leadFailure.result?.source || null, adapter: leadFailure.result?.adapter || null, endpoint: leadFailure.result?.endpoint || null, failures: leadFailure.result?.failures || [], retryable: leadFailure.result?.retryable !== false } });
  if (media?.stage === "needs_renderer" && !blockers.some(x => x.id === "media_renderer")) blockers.push({ id: "media_renderer", priority: 1, reason: "A video renderer is required to turn ZOZ AI scripts into publishable MP4 assets", requiredEnv: "J2V_API_KEY", solution: "JSON2Video API" });
  if (agents.some(x => x.agent === "youtube" && x.result?.stage === "connection") && !blockers.some(x => x.id === "youtube_connection")) blockers.push({ id: "youtube_connection", priority: 1, reason: "YouTube connector is not configured for the server runtime" });
  const run = await memory.recordRun({ id: id("runtime"), mode: "autonomous_runtime", trigger, reconciliation, heartbeat, media, agents, blockers, completedAt: now() });
  return { ok: true, autonomous: memory.durable && blockers.length === 0, durableMemory: memory.durable, memoryStatus, reconciliation, heartbeat, media, agents, blockers, lastRun: run, snapshot };
}

async function reconcileAutonomyState() {
  const memory = createMemoryStore();
  const memoryStatus = await memory.init();
  const reconciliation = await reconcileExistingState(memory);
  return { ok: true, autonomous: memory.durable && reconciliation.blockers.length === 0, durableMemory: memory.durable, memoryStatus, reconciliation, snapshot: await memory.load() };
}
async function getAutonomyStatus() {
  const memory = createMemoryStore();
  const memoryStatus = await memory.init();
  const snapshot = await memory.load();
  return { ok: true, autonomous: memory.durable && snapshot.controlPlane?.blockers?.length === 0, durableMemory: memory.durable, memoryStatus, identity: snapshot.identity, goals: snapshot.goals, projects: snapshot.projects, opportunities: snapshot.opportunities.slice(-50), content: snapshot.content.slice(-50), channelState: snapshot.channelState, controlPlane: snapshot.controlPlane, runs: snapshot.runs.slice(-20), updatedAt: snapshot.updatedAt };
}
module.exports = { runAutonomousRuntime, getAutonomyStatus, reconcileAutonomyState, reconcileExistingState };
