const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

const root = __dirname;
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const script = fs.readFileSync(path.join(root, "scripts", "enable-postgres-persistence.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

assert.strictEqual(packageJson.scripts["vercel-build"], "node scripts/enable-postgres-persistence.js");
assert.ok(packageJson.scripts.test.includes("persistence.test.js"));
assert.ok(vercel.builds.some((build) => build.use === "@vercel/node" && build.src === "server.js"));
assert.ok(script.includes('const { Pool } = require("pg");'));
assert.ok(script.includes("const pgPool = DATABASE_URL"));
assert.ok(script.includes("async function readKvState()"));
assert.ok(script.includes("await saveState();"));
assert.ok(script.includes("persistence_migrated_from_kv"));
assert.ok(script.includes("KV_REST_API_URL && KV_REST_API_TOKEN"));

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zoz-persistence-test-"));
try {
  fs.mkdirSync(path.join(tempDir, "scripts"));
  fs.copyFileSync(path.join(root, "scripts", "enable-postgres-persistence.js"), path.join(tempDir, "scripts", "enable-postgres-persistence.js"));
  const fixture = [
    'const business = require("./business");',
    'const KV_REST_API_URL = process.env.KV_REST_API_URL;',
    'const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;',
    'const DATABASE_URL = process.env.DATABASE_URL;',
    'const persistence = { enabled: Boolean(DATABASE_URL), provider: DATABASE_URL ? "postgresql" : "memory", key: "test" };',
    'async function loadState() { if (!KV_REST_API_URL) return; }',
    'async function saveState() { if (!KV_REST_API_URL) return; }',
    'function isFinanciallySensitive(text = "") { return /payment/i.test(text); }',
  ].join("\n");
  fs.writeFileSync(path.join(tempDir, "server.js"), fixture);
  fs.writeFileSync(path.join(tempDir, "business.js"), "module.exports = { createBusinessState: () => ({}) };\n");
  cp.execFileSync(process.execPath, [path.join(tempDir, "scripts", "enable-postgres-persistence.js")], { cwd: tempDir, stdio: "pipe" });
  const patched = fs.readFileSync(path.join(tempDir, "server.js"), "utf8");
  assert.ok(patched.includes('const { Pool } = require("pg");'));
  assert.ok(patched.includes("async function ensurePostgres()"));
  assert.ok(patched.includes("async function readKvState()"));
  assert.ok(patched.includes("if (pgPool)"));
  assert.ok(patched.includes("await kvSet(persistence.key, payload)"));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("Persistence tests passed: Vercel build hook, PostgreSQL path, KV fallback, and bootstrap patching are covered.");
