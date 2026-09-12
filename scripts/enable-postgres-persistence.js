const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "server.js");
let source = fs.readFileSync(file, "utf8");

if (!source.includes('const { Pool } = require("pg");')) {
  source = source.replace(
    'const business = require("./business");',
    'const business = require("./business");\nconst { Pool } = require("pg");'
  );
}

if (!source.includes("const pgPool = DATABASE_URL")) {
  source = source.replace(
    'const persistence = {',
    'const pgPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 }) : null;\n\nconst persistence = {'
  );
}

const loadStart = source.indexOf("async function loadState()");
const sensitiveStart = source.indexOf("function isFinanciallySensitive");
if (loadStart < 0 || sensitiveStart < 0 || sensitiveStart <= loadStart) {
  throw new Error("Persistence function markers not found");
}

const persistenceFunctions = `async function ensurePostgres() {
  if (!pgPool) return;
  await pgPool.query('CREATE TABLE IF NOT EXISTS zoz_state (id TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
}
function applySavedState(saved) {
  if (!saved || typeof saved !== "object") return false;
  state.jobs = Array.isArray(saved.jobs) ? saved.jobs : [];
  state.approvals = Array.isArray(saved.approvals) ? saved.approvals : [];
  state.audit = Array.isArray(saved.audit) ? saved.audit.slice(-500) : [];
  if (saved.business && typeof saved.business === "object") state.business = { ...business.createBusinessState(), ...saved.business };
  return true;
}
async function readKvState() {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return false;
  const result = await kvGet(persistence.key);
  const saved = result && result.result ? (typeof result.result === "string" ? JSON.parse(result.result) : result.result) : null;
  return applySavedState(saved);
}
async function loadState() {
  if (pgPool) {
    try {
      await ensurePostgres();
      const result = await pgPool.query('SELECT payload FROM zoz_state WHERE id = $1', [persistence.key]);
      const saved = result.rows[0] && result.rows[0].payload;
      if (applySavedState(saved)) return;
      if (await readKvState()) {
        await saveState();
        audit("persistence_migrated_from_kv", { provider: "postgresql" });
      }
      return;
    } catch (error) {
      console.error("PostgreSQL load warning:", error.message);
      audit("persistence_load_failed", { message: error.message, provider: "postgresql" });
      try { await readKvState(); } catch (kvError) { audit("persistence_load_failed", { message: kvError.message, provider: "kv" }); }
      return;
    }
  }
  try { await readKvState(); } catch (error) { audit("persistence_load_failed", { message: error.message, provider: "kv" }); }
}
async function saveState() {
  const payload = { ...state, savedAt: new Date().toISOString() };
  let postgresSaved = false;
  if (pgPool) {
    try {
      await ensurePostgres();
      await pgPool.query('INSERT INTO zoz_state (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()', [persistence.key, JSON.stringify(payload)]);
      postgresSaved = true;
    } catch (error) {
      console.error("PostgreSQL save warning:", error.message);
      audit("persistence_save_failed", { message: error.message, provider: "postgresql" });
    }
  }
  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    try { await kvSet(persistence.key, payload); }
    catch (error) {
      console.error("KV state save warning:", error.message);
      audit("persistence_save_failed", { message: error.message, provider: "kv" });
    }
  }
  if (!postgresSaved && !KV_REST_API_URL) return;
}
`;
source = source.slice(0, loadStart) + persistenceFunctions + source.slice(sensitiveStart);

if (!source.includes('app.get("/api/persistence/check"')) {
  const marker = 'app.get("/api/state", (req, res) =>';
  const probe = 'app.get("/api/persistence/check", async (req, res) => { if (!pgPool && !(KV_REST_API_URL && KV_REST_API_TOKEN)) return res.status(503).json({ ok: false, provider: persistence.provider, error: "persistence_not_configured" }); try { if (pgPool) { await ensurePostgres(); await pgPool.query("SELECT 1"); return res.json({ ok: true, provider: "postgresql", writable: true, readable: true }); } const data = await kvGet(persistence.key); return res.json({ ok: true, provider: "KV-compatible REST", writable: true, readable: Boolean(data && data.result) }); } catch (error) { return res.status(503).json({ ok: false, provider: persistence.provider, error: "persistence_unavailable" }); } });\n';
  source = source.replace(marker, probe + marker);
}

fs.writeFileSync(file, source);
console.log("PostgreSQL persistence bootstrap applied");

if (process.env.ZOZ_PERSISTENCE_PROVIDER === "postgresql") {
  const { Pool } = require("pg");
  if (!process.env.DATABASE_URL) throw new Error("PostgreSQL persistence is required but DATABASE_URL is missing");
  const verifyPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
  (async () => {
    try {
      await verifyPool.query("CREATE TABLE IF NOT EXISTS zoz_state (id TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      const probeId = "bootstrap_persistence_probe";
      const payload = JSON.stringify({ checkedAt: new Date().toISOString(), provider: "postgresql" });
      await verifyPool.query("INSERT INTO zoz_state (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()", [probeId, payload]);
      const result = await verifyPool.query("SELECT payload FROM zoz_state WHERE id = $1", [probeId]);
      if (!result.rows[0]) throw new Error("PostgreSQL persistence read-back failed");
      console.log("PostgreSQL persistence verified: write/read successful");
    } finally {
      await verifyPool.end();
    }
  })().catch((error) => {
    console.error("PostgreSQL persistence verification failed:", error.message);
    process.exitCode = 1;
  });
}
