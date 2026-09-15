const { Pool } = require("pg");

const MEMORY_VERSION = 1;
const MAX_ITEMS = 2000;
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

function blankMemory() {
  return {
    version: MEMORY_VERSION,
    identity: { name: process.env.ZOZ_NAME || "ZOZ AI", role: "AI Business Operating System" },
    goals: [],
    projects: [],
    contacts: [],
    opportunities: [],
    content: [],
    decisions: [],
    learnings: [],
    facts: [],
    channelState: {},
    runs: [],
    updatedAt: now()
  };
}

function bounded(items) { return Array.isArray(items) ? items.slice(-MAX_ITEMS) : []; }

function createMemoryStore() {
  const connectionString = process.env.DATABASE_URL || process.env.ZOZ_DATABASE_URL;
  const pool = connectionString ? new Pool({ connectionString, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } }) : null;
  let memory = blankMemory();

  async function init() {
    if (!pool) return { durable: false, provider: "process_memory" };
    await pool.query(`CREATE TABLE IF NOT EXISTS zoz_ai_memory (id integer PRIMARY KEY, memory jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    const result = await pool.query(`SELECT memory FROM zoz_ai_memory WHERE id=1`);
    if (result.rows[0]?.memory) memory = { ...blankMemory(), ...result.rows[0].memory };
    else await save();
    return { durable: true, provider: "postgresql" };
  }

  async function load() {
    if (pool) {
      const result = await pool.query(`SELECT memory FROM zoz_ai_memory WHERE id=1`);
      if (result.rows[0]?.memory) memory = { ...blankMemory(), ...result.rows[0].memory };
    }
    return memory;
  }

  async function save() {
    memory.updatedAt = now();
    for (const key of ["goals","projects","contacts","opportunities","content","decisions","learnings","facts","runs"]) memory[key] = bounded(memory[key]);
    if (!pool) return { durable: false };
    await pool.query(`INSERT INTO zoz_ai_memory(id,memory,updated_at) VALUES(1,$1::jsonb,now()) ON CONFLICT(id) DO UPDATE SET memory=EXCLUDED.memory,updated_at=now()`, [JSON.stringify(memory)]);
    return { durable: true };
  }

  async function remember(type, data) {
    const allowed = new Set(["goals","projects","contacts","opportunities","content","decisions","learnings","facts"]);
    if (!allowed.has(type)) throw new Error("unsupported_memory_type");
    const item = { id: data.id || id(type.slice(0, -1)), ...data, rememberedAt: now() };
    memory[type].push(item);
    await save();
    return item;
  }

  async function recordRun(run) {
    memory.runs.push({ id: run.id || id("run"), ...run, at: now() });
    await save();
    return memory.runs[memory.runs.length - 1];
  }

  async function setChannel(name, state) {
    memory.channelState[name] = { ...memory.channelState[name], ...state, updatedAt: now() };
    await save();
    return memory.channelState[name];
  }

  function snapshot() { return JSON.parse(JSON.stringify(memory)); }

  return { durable: Boolean(pool), init, load, save, remember, recordRun, setChannel, snapshot };
}

module.exports = { createMemoryStore, blankMemory, MEMORY_VERSION };
