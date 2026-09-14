const crypto = require("crypto");

const now = () => new Date().toISOString();
const id = p => `${p}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

const STATES = ["unknown", "healthy", "degraded", "blocked", "failed", "recovering"];
const SEVERITY = ["info", "warning", "critical"];

const COMPONENTS = {
  github: { critical: true, checks: ["auth", "read", "write"] },
  vercel: { critical: true, checks: ["deployment", "runtime"] },
  database: { critical: true, checks: ["connection", "persistence"] },
  execution_engine: { critical: true, checks: ["runtime", "queue", "proof"] },
  whatsapp: { critical: true, checks: ["credentials", "outbound", "inbound", "webhook"] },
  peach: { critical: true, checks: ["credentials", "api", "template"] },
  codex: { critical: false, checks: ["access", "workspace", "tests"] },
  automation: { critical: false, checks: ["trigger", "cycle"] },
  file_system: { critical: false, checks: ["read", "write", "integrity"] }
};

const SAFE_AUTO_REPAIR = new Set([
  "retry_transient_check",
  "restart_local_worker",
  "rebuild_runtime_cache",
  "recreate_temp_directory",
  "requeue_failed_safe_task",
  "restore_non_secret_config_from_known_schema"
]);

const DANGEROUS_REPAIR = new Set([
  "delete_data",
  "rotate_credentials",
  "change_billing",
  "purchase_service",
  "send_money",
  "disable_security",
  "force_push",
  "drop_database"
]);

function createHealthState() {
  const components = {};
  for (const [name, meta] of Object.entries(COMPONENTS)) {
    components[name] = {
      name,
      critical: meta.critical,
      state: "unknown",
      score: 0,
      checks: Object.fromEntries(meta.checks.map(c => [c, { state: "unknown", at: null, evidence: null } ])),
      lastHealthyAt: null,
      lastFailureAt: null,
      repairAttempts: 0,
      openIncidents: []
    };
  }
  return {
    version: 1,
    overall: "unknown",
    components,
    incidents: [],
    repairQueue: [],
    repairHistory: [],
    diagnostics: [],
    lastScanAt: null,
    nextScanAt: null,
    policy: {
      autoRepairEnabled: true,
      maxAttemptsPerIncident: 3,
      financialActionsAlwaysHuman: true,
      destructiveActionsAlwaysHuman: true,
      secretRotationAlwaysHuman: true,
      neverExposeSecrets: true,
      neverForcePush: true,
      neverDeleteUserDataAutomatically: true
    }
  };
}

function recordCheck(state, component, check, result = {}) {
  if (!state.components[component]) throw new Error(`Unknown component: ${component}`);
  const target = state.components[component];
  if (!target.checks[check]) target.checks[check] = {};
  const checkState = result.state || "unknown";
  target.checks[check] = {
    state: checkState,
    at: now(),
    evidence: result.evidence || null,
    latencyMs: Number.isFinite(result.latencyMs) ? result.latencyMs : null,
    errorClass: result.errorClass || null
  };
  const values = Object.values(target.checks).map(x => x.state);
  target.state = values.includes("failed") ? "failed" : values.includes("blocked") ? "blocked" : values.includes("degraded") ? "degraded" : values.every(x => x === "healthy") ? "healthy" : "unknown";
  target.score = target.state === "healthy" ? 100 : target.state === "degraded" ? 70 : target.state === "unknown" ? 0 : target.state === "blocked" ? 30 : 10;
  if (target.state === "healthy") target.lastHealthyAt = now();
  if (["failed", "blocked"].includes(target.state)) target.lastFailureAt = now();
  return target;
}

function classifyFailure(error = {}) {
  const text = String(error.message || error.error || error.details || "").toLowerCase();
  if (/timeout|temporar|429|rate limit|econnreset|503|502/.test(text)) return { class: "transient", confidence: 90 };
  if (/auth|unauthorized|forbidden|401|403|token|credential/.test(text)) return { class: "authentication", confidence: 90 };
  if (/not found|404|missing file|enoent/.test(text)) return { class: "missing_resource", confidence: 85 };
  if (/syntax|module|require|import|build|compile/.test(text)) return { class: "code_or_build", confidence: 85 };
  if (/database|postgres|sql|connection/.test(text)) return { class: "database", confidence: 85 };
  if (/webhook|template|whatsapp|peach/.test(text)) return { class: "messaging", confidence: 85 };
  if (/disk|space|file|permission|path/.test(text)) return { class: "filesystem", confidence: 80 };
  return { class: "unknown", confidence: 30 };
}

function proposeRepairs(incident) {
  const c = incident.failureClass;
  if (c === "transient") return ["retry_transient_check", "requeue_failed_safe_task"];
  if (c === "missing_resource") return ["recreate_temp_directory", "restore_non_secret_config_from_known_schema"];
  if (c === "code_or_build") return ["rebuild_runtime_cache"];
  if (c === "filesystem") return ["recreate_temp_directory"];
  if (c === "database") return ["retry_transient_check"];
  if (c === "authentication") return [];
  if (c === "messaging") return ["retry_transient_check"];
  return ["retry_transient_check"];
}

function openIncident(state, input = {}) {
  const failure = classifyFailure(input.error || input);
  const incident = {
    id: id("incident"),
    component: input.component || "unknown",
    taskId: input.taskId || null,
    failureClass: failure.class,
    confidence: failure.confidence,
    severity: input.severity || (COMPONENTS[input.component]?.critical ? "critical" : "warning"),
    message: String(input.message || input.error?.message || "Unknown failure"),
    evidence: input.evidence || null,
    createdAt: now(),
    updatedAt: now(),
    status: "open",
    attempts: 0,
    proposedRepairs: proposeRepairs({ failureClass: failure.class })
  };
  state.incidents.push(incident);
  if (state.incidents.length > 500) state.incidents = state.incidents.slice(-500);
  state.repairQueue.push({ incidentId: incident.id, actions: incident.proposedRepairs, nextAction: 0, queuedAt: now() });
  state.components[incident.component]?.openIncidents.push(incident.id);
  return incident;
}

function canAutoRepair(action, incident) {
  if (!SAFE_AUTO_REPAIR.has(action)) return { allowed: false, reason: DANGEROUS_REPAIR.has(action) ? "human_approval_required" : "unknown_repair_not_allowed" };
  if (incident.severity === "critical" && incident.failureClass === "authentication") return { allowed: false, reason: "credential_issue_requires_human" };
  return { allowed: true };
}

async function executeRepair(state, item, executor = {}) {
  const incident = state.incidents.find(x => x.id === item.incidentId);
  if (!incident) return { executed: false, reason: "incident_not_found" };
  if (incident.attempts >= state.policy.maxAttemptsPerIncident) return { executed: false, reason: "max_repair_attempts_reached" };
  const action = item.actions[item.nextAction];
  if (!action) return { executed: false, reason: "no_repair_action" };
  const gate = canAutoRepair(action, incident);
  if (!gate.allowed) {
    incident.status = "human_action_required";
    incident.updatedAt = now();
    return { executed: false, reason: gate.reason, action };
  }
  incident.attempts += 1;
  const result = typeof executor[action] === "function" ? await executor[action](incident) : { ok: false, reason: "repair_adapter_missing" };
  state.repairHistory.push({ id: id("repair"), incidentId: incident.id, action, result, at: now() });
  if (result.ok) {
    incident.status = "recovering";
    incident.updatedAt = now();
    item.nextAction += 1;
    return { executed: true, repaired: true, action, result };
  }
  item.nextAction += 1;
  incident.updatedAt = now();
  return { executed: true, repaired: false, action, result };
}

function recalculateOverall(state) {
  const critical = Object.values(state.components).filter(x => x.critical);
  if (critical.some(x => x.state === "failed")) state.overall = "failed";
  else if (critical.some(x => x.state === "blocked")) state.overall = "blocked";
  else if (Object.values(state.components).some(x => ["failed", "blocked", "degraded"].includes(x.state))) state.overall = "degraded";
  else if (critical.length && critical.every(x => x.state === "healthy")) state.overall = "healthy";
  else state.overall = "unknown";
  return state.overall;
}

async function runHealthCycle(state, adapters = {}) {
  state.lastScanAt = now();
  const checks = [];
  for (const [component, meta] of Object.entries(COMPONENTS)) {
    for (const check of meta.checks) {
      const key = `${component}:${check}`;
      try {
        const fn = adapters[key] || adapters[component];
        const result = typeof fn === "function" ? await fn({ component, check }) : { state: "unknown", evidence: "adapter_not_configured" };
        recordCheck(state, component, check, result);
        checks.push({ component, check, ...result });
      } catch (error) {
        const failure = classifyFailure(error);
        recordCheck(state, component, check, { state: "failed", errorClass: failure.class, evidence: { message: String(error.message || error) } });
        openIncident(state, { component, message: String(error.message || error), error, evidence: { check } });
        checks.push({ component, check, state: "failed", errorClass: failure.class });
      }
    }
  }
  for (const item of state.repairQueue.filter(x => x.nextAction < x.actions.length)) await executeRepair(state, item, adapters);
  recalculateOverall(state);
  state.nextScanAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  state.diagnostics.push({ id: id("diag"), at: now(), overall: state.overall, checks: checks.length, openIncidents: state.incidents.filter(x => ["open", "recovering"].includes(x.status)).length });
  if (state.diagnostics.length > 200) state.diagnostics = state.diagnostics.slice(-200);
  return { overall: state.overall, checks, openIncidents: state.incidents.filter(x => x.status !== "resolved"), repairQueue: state.repairQueue };
}

module.exports = {
  STATES,
  SEVERITY,
  COMPONENTS,
  SAFE_AUTO_REPAIR,
  DANGEROUS_REPAIR,
  createHealthState,
  recordCheck,
  classifyFailure,
  proposeRepairs,
  openIncident,
  canAutoRepair,
  executeRepair,
  recalculateOverall,
  runHealthCycle
};
