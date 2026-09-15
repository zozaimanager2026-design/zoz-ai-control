const { Pool } = require("pg");

const MEMORY_VERSION = 3;
const MAX_ITEMS = 2000;
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

function blankMemory() {
  return {
    version: MEMORY_VERSION,
    identity: { name: process.env.ZOZ_NAME || "ZOZ AI", role: "AI Business Operating System" },
    goals: [], projects: [], contacts: [], contactHistory: [], opportunities: [], content: [],
    decisions: [], learnings: [], facts: [], channelState: {}, runs: [],
    blockers: [], integrations: {}, controlPlane: {
      schemaVersion: 2, lastReconciledAt: null, nextAction: null,
      sources: {}, recordCounts: {}, duplicatePolicy: "suppress_by_phone_email_website_or_name_address"
    },
    updatedAt: now()
  };
}

function bounded(items) { return Array.isArray(items) ? items.slice(-MAX_ITEMS) : []; }

function createMemoryStore() {
  const connectionString = process.env.DATABASE_URL || process.env.ZOZ_DATABASE_URL;
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.ZOZ_KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.ZOZ_KV_REST_API_TOKEN;
  const pool = connectionString ? new Pool({ connectionString, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } }) : null;
  const durableProvider = pool ? "postgresql" : (kvUrl && kvToken ? "upstash_redis_rest" : "process_memory");
  let memory = blankMemory();
  const kvKey = process.env.ZOZ_MEMORY_KEY || "zoz:ai:memory:v2";

  async function kvRequest(command, args = []) {
    const response = await fetch(`${kvUrl}/${command}/${args.map(encodeURIComponent).join("/")}`, { headers: { Authorization: `Bearer ${kvToken}` } });
    if (!response.ok) throw new Error(`kv_http_${response.status}`);
    return response.json();
  }
  async function kvLoad() {
    const result = await kvRequest("get", [kvKey]);
    const raw = result && result.result;
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
  async function kvSave(value) { return kvRequest("set", [kvKey, JSON.stringify(value)]); }

  async function init() {
    if (pool) {
      await pool.query(`CREATE TABLE IF NOT EXISTS zoz_ai_memory (id integer PRIMARY KEY, memory jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
      const result = await pool.query(`SELECT memory FROM zoz_ai_memory WHERE id=1`);
      if (result.rows[0]?.memory) memory = { ...blankMemory(), ...result.rows[0].memory };
      else await save();
      return status();
    }
    if (kvUrl && kvToken) {
      const saved = await kvLoad();
      if (saved) memory = { ...blankMemory(), ...saved };
      else await save();
      return status();
    }
    return status();
  }

  async function load() {
    if (pool) {
      const result = await pool.query(`SELECT memory FROM zoz_ai_memory WHERE id=1`);
      if (result.rows[0]?.memory) memory = { ...blankMemory(), ...result.rows[0].memory };
    } else if (kvUrl && kvToken) {
      const saved = await kvLoad();
      if (saved) memory = { ...blankMemory(), ...saved };
    }
    return memory;
  }

  async function save() {
    memory.updatedAt = now();
    for (const key of ["goals","projects","contacts","contactHistory","opportunities","content","decisions","learnings","facts","runs","blockers"]) memory[key] = bounded(memory[key]);
    memory.controlPlane.recordCounts = Object.fromEntries(["goals","projects","contacts","contactHistory","opportunities","content","decisions","learnings","facts","runs","blockers"].map(k => [k, memory[k].length]));
    if (pool) {
      await pool.query(`INSERT INTO zoz_ai_memory(id,memory,updated_at) VALUES(1,$1::jsonb,now()) ON CONFLICT(id) DO UPDATE SET memory=EXCLUDED.memory,updated_at=now()`, [JSON.stringify(memory)]);
      return { durable: true, provider: "postgresql" };
    }
    if (kvUrl && kvToken) { await kvSave(memory); return { durable: true, provider: "upstash_redis_rest" }; }
    return { durable: false, provider: "process_memory" };
  }

  async function remember(type, data) {
    const allowed = new Set(["goals","projects","contacts","opportunities","content","decisions","learnings","facts"]);
    if (!allowed.has(type)) throw new Error("unsupported_memory_type");
    const item = { id: data.id || id(type.slice(0, -1)), ...data, rememberedAt: now() };
    const existingIndex = memory[type].findIndex(existing => existing.id === item.id);
    if (existingIndex >= 0) memory[type][existingIndex] = { ...memory[type][existingIndex], ...item };
    else memory[type].push(item);
    await save();
    return item;
  }

  async function rememberContactEvent(data) {
    const item = { id: data.id || id("contact"), ...data, timestamp: data.timestamp || now() };
    memory.contactHistory.push(item);
    await save();
    return item;
  }
  async function recordRun(run) { memory.runs.push({ id: run.id || id("run"), ...run, at: now() }); await save(); return memory.runs[memory.runs.length - 1]; }
  async function setChannel(name, state) { memory.channelState[name] = { ...memory.channelState[name], ...state, updatedAt: now() }; await save(); return memory.channelState[name]; }
  async function setControlPlane(data) { memory.controlPlane = { ...memory.controlPlane, ...data, updatedAt: now() }; await save(); return memory.controlPlane; }
  function status() { return { durable: durableProvider !== "process_memory", provider: durableProvider, key: kvKey, lastReconciledAt: memory.controlPlane.lastReconciledAt, recordCounts: memory.controlPlane.recordCounts }; }
  function snapshot() { return JSON.parse(JSON.stringify(memory)); }
  return { durable: durableProvider !== "process_memory", provider: durableProvider, init, load, save, remember, rememberContactEvent, recordRun, setChannel, setControlPlane, status, snapshot };
}

module.exports = { createMemoryStore, blankMemory, MEMORY_VERSION };
