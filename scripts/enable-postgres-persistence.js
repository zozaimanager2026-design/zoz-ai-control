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
  const marker = 'const persistence = {\n';
  const poolCode = 'const pgPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 }) : null;\n\n';
  source = source.replace(marker, poolCode + marker);
}

const loadStart = source.indexOf("async function loadState()");
const sensitiveStart = source.indexOf("function isFinanciallySensitive");
if (loadStart < 0 || sensitiveStart < 0 || sensitiveStart <= loadStart) {
  throw new Error("Persistence function markers not found");
}

const persistenceFunctions = [
  'async function ensurePostgres() {',
  '  if (!pgPool) return;',
  "  await pgPool.query('CREATE TABLE IF NOT EXISTS zoz_state (id TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');",
  '}',
  'async function loadState() {',
  '  if (pgPool) {',
  '    try {',
  '      await ensurePostgres();',
  '      const result = await pgPool.query(\'SELECT payload FROM zoz_state WHERE id = $1\', [persistence.key]);',
  '      const saved = result.rows[0] && result.rows[0].payload;',
  '      if (saved && typeof saved === "object") {',
  '        state.jobs = Array.isArray(saved.jobs) ? saved.jobs : [];',
  '        state.approvals = Array.isArray(saved.approvals) ? saved.approvals : [];',
  '        state.audit = Array.isArray(saved.audit) ? saved.audit.slice(-500) : [];',
  '        if (saved.business && typeof saved.business === "object") state.business = { ...business.createBusinessState(), ...saved.business };',
  '      }',
  '      return;',
  '    } catch (error) {',
  '      console.error("PostgreSQL load warning:", error.message);',
  '      audit("persistence_load_failed", { message: error.message, provider: "postgresql" });',
  '    }',
  '  }',
  '  if (KV_REST_API_URL && KV_REST_API_TOKEN) {',
  '    try {',
  '      const result = await kvGet(persistence.key);',
  '      if (result && result.result) {',
  '        const saved = typeof result.result === "string" ? JSON.parse(result.result) : result.result;',
  '        if (saved && typeof saved === "object") {',
  '          state.jobs = Array.isArray(saved.jobs) ? saved.jobs : [];',
  '          state.approvals = Array.isArray(saved.approvals) ? saved.approvals : [];',
  '          state.audit = Array.isArray(saved.audit) ? saved.audit.slice(-500) : [];',
  '          if (saved.business && typeof saved.business === "object") state.business = { ...business.createBusinessState(), ...saved.business };',
  '        }',
  '      }',
  '    } catch (error) {',
  '      console.error("State load warning:", error.message);',
  '      audit("persistence_load_failed", { message: error.message });',
  '    }',
  '  }',
  '}',
  'async function saveState() {',
  '  const payload = { ...state, savedAt: new Date().toISOString() };',
  '  if (pgPool) {',
  '    try {',
  '      await ensurePostgres();',
  '      await pgPool.query(\'INSERT INTO zoz_state (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()\', [persistence.key, JSON.stringify(payload)]);',
  '      return;',
  '    } catch (error) {',
  '      console.error("PostgreSQL save warning:", error.message);',
  '    }',
  '  }',
  '  if (KV_REST_API_URL && KV_REST_API_TOKEN) {',
  '    try { await kvSet(persistence.key, payload); } catch (error) { console.error("State save warning:", error.message); }',
  '  }',
  '}',
  ''
].join("\n");

source = source.slice(0, loadStart) + persistenceFunctions + source.slice(sensitiveStart);

const oldDatabaseBranch = 'if (KV_REST_API_URL && KV_REST_API_TOKEN) { const data = await kvGet(persistence.key); result = { id, status: "verified", verified: true, detail: "KV REST read succeeded", hasState: Boolean(data && data.result) }; } else { result = { id, status: "configured_unverified", verified: false, detail: "DATABASE_URL configured; database adapter pending" }; }';
const newDatabaseBranch = 'if (pgPool) { await ensurePostgres(); await pgPool.query("SELECT 1"); result = { id, status: "verified", verified: true, detail: "PostgreSQL read succeeded" }; } else if (KV_REST_API_URL && KV_REST_API_TOKEN) { const data = await kvGet(persistence.key); result = { id, status: "verified", verified: true, detail: "KV REST read succeeded", hasState: Boolean(data && data.result) }; } else { result = { id, status: "configured_unverified", verified: false, detail: "DATABASE_URL configured; database adapter unavailable" }; }';
if (!source.includes(newDatabaseBranch)) {
  source = source.replace(oldDatabaseBranch, newDatabaseBranch);
}

fs.writeFileSync(file, source);
console.log("PostgreSQL persistence bootstrap applied");
