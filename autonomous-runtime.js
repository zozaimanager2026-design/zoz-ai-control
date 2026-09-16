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

function scoreContent(item) {
  const text = `${item.title || ""} ${item.body || ""} ${item.hook || ""} ${item.cta || ""}`.trim();
  const checks = {
    hook: Boolean(item.hook || /\?|أنت|تخيل|لو |ماذا لو|ليه|إزاي|كيف/.test(text)),
    clearPromise: Boolean(/سوف|هت|هتتعلم|تعرف|خطوة|حل|طريقة|نتيجة|بدل|كيف|إزاي/.test(text)),
    specificity: text.length >= 180 && text.length <= 5000,
    retentionStructure: Boolean(/\n/.test(String(item.body || "")) && String(item.body || "").length >= 300),
    cta: Boolean(item.cta || /تابع|اشترك|اكتب|علق|شوف|جرّب|جرب/.test(text)),
    originality: !/نسخة طبق الأصل|copy paste|copied/i.test(text),
    factualSafety: !/guaranteed|مضمون 100%|اربح أكيد|ثراء سريع/i.test(text)
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { score: Math.round((passed / Object.keys(checks).length) * 100), checks, passed, total: Object.keys(checks).length };
}

function buildProductionBrief(item) {
  const hook = item.hook || item.title || "ابدأ بسؤال يوقف التمرير";
  return {
    format: "youtube_long_shortform_hybrid",
    targetSeconds: 60,
    audience: "أصحاب الأعمال والأشخاص الذين يريدون تحويل AI من أداة إجابة إلى نظام تنفيذ",
    hook,
    promise: "قيمة واضحة خلال أول ثوانٍ بدون مقدمة طويلة",
    structure: ["hook_0_3s", "problem_3_12s", "insight_12_28s", "proof_or_example_28_48s", "payoff_48_55s", "cta_55_60s"],
    pacing: "fast_clear",
    visualRule: "تغيير بصري أو معلومة جديدة كل عدة ثوانٍ مع إبراز الكلمات المهمة",
    subtitleRule: "Arabic readable subtitles, short lines, safe margins, no legacy pixel strings",
    audioRule: "clear Arabic voice, consistent loudness, no clipped narration",
    qa: ["hook_present", "promise_clear", "no_long_intro", "visual_rhythm", "readable_subtitles", "audio_clear", "cta_present", "no_factual_overclaim"],
    thumbnail: { required: true, rule: "فكرة بصرية واحدة + نص قصير عالي الوضوح + هوية ZOZ AI" },
    metadata: { titleRequired: true, descriptionRequired: true, keywordsRequired: true },
    publish: { previewRequired: true, humanApprovalRequired: true }
  };
}

async function runContentProductionGate(memoryStore) {
  const memory = await memoryStore.load();
  const candidates = memory.content.filter(x => x.goalKey === "youtube_growth" && ["planned", "draft"].includes(x.status) && !x.renderProjectId);
  if (!candidates.length) return { ok: true, stage: "no_content_gate_candidate" };
  const item = candidates[candidates.length - 1];
  const quality = scoreContent(item);
  const brief = buildProductionBrief(item);
  const enriched = { ...item, productionBrief: brief, qualityGate: quality, contentStrategyVersion: 1, title: item.title === "ZOZ AI YouTube draft" ? "خلّي الـAI يشتغل بدلًا منك" : item.title, productionStage: quality.score >= 70 ? "approved_for_render" : "needs_script_revision" };
  if (quality.score >= 70) enriched.status = "planned";
  await memoryStore.remember("content", enriched);
  return { ok: quality.score >= 70, stage: enriched.productionStage, contentId: enriched.id, qualityScore: quality.score, qualityChecks: quality.checks, productionBrief: brief };
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

  let agents;
  try {
    agents = await executeAutonomousAgents(memory);
  } catch (error) {
    agents = [{ agent: "runtime", result: { ok: false, stage: "agent_runtime_exception", reason: String(error?.message || error).slice(0, 300), retryable: true } }];
  }

  let contentPipeline;
  try {
    contentPipeline = await runContentProductionGate(memory);
  } catch (error) {
    contentPipeline = { ok: false, stage: "content_pipeline_exception", reason: String(error?.message || error).slice(0, 300), retryable: true };
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
  if (contentPipeline?.stage === "needs_script_revision" && !blockers.some(x => x.id === "content_quality_gate")) blockers.push({ id: "content_quality_gate", priority: 2, reason: "Generated content did not pass the production quality gate", qualityScore: contentPipeline.qualityScore || 0, nextAction: "revise_hook_structure_value_and_cta" });
  if (media?.stage === "needs_renderer" && !blockers.some(x => x.id === "media_renderer")) blockers.push({ id: "media_renderer", priority: 1, reason: "A video renderer is required to turn ZOZ AI scripts into publishable MP4 assets", requiredEnv: "J2V_API_KEY", solution: "JSON2Video API" });
  if (["render_failed", "render_submit_failed", "render_poll_failed", "media_runtime_exception"].includes(media?.stage) && !blockers.some(x => x.id === "media_renderer_failure")) blockers.push({ id: "media_renderer_failure", priority: 1, reason: media.reason || "Video rendering failed during the autonomous run", diagnostic: { stage: media.stage, contentId: media.contentId || null, retryExhausted: media.retryExhausted === true }, nextAction: "diagnose_renderer_and_use_compatibility_fallback" });
  if (["publish_failed", "needs_publisher"].includes(media?.stage) && !blockers.some(x => x.id === "publisher_failure")) blockers.push({ id: "publisher_failure", priority: 1, reason: media.publication?.reason || media.reason || "Publishing failed during the autonomous run", nextAction: "diagnose_publisher_connection" });
  if (agents.some(x => x.agent === "youtube" && x.result?.stage === "connection") && !blockers.some(x => x.id === "youtube_connection")) blockers.push({ id: "youtube_connection", priority: 1, reason: "YouTube connector is not configured for the server runtime" });
  const run = await memory.recordRun({ id: id("runtime"), mode: "autonomous_runtime", trigger, reconciliation, heartbeat, contentPipeline, media, agents, blockers, completedAt: now() });
  return { ok: true, autonomous: memory.durable && blockers.length === 0, durableMemory: memory.durable, memoryStatus, reconciliation, heartbeat, contentPipeline, media, agents, blockers, lastRun: run, snapshot };
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
module.exports = { runAutonomousRuntime, getAutonomyStatus, reconcileAutonomyState, reconcileExistingState, runContentProductionGate, scoreContent, buildProductionBrief };
