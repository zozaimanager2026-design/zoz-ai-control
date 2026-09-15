const assert = require("assert");
const { blankMemory, createMemoryStore } = require("./zoz-memory");
const { createAutonomyCore, financial } = require("./autonomy-core");

(async () => {
  const initial = blankMemory();
  assert.strictEqual(initial.identity.name, "ZOZ AI");
  assert.deepStrictEqual(initial.goals, []);
  assert.strictEqual(financial("إنشاء منشور YouTube"), false);
  assert.strictEqual(financial("دفع ثمن المنتج"), true);
  const store = createMemoryStore();
  const core = createAutonomyCore(store);
  const run = await core.heartbeat({ test: true });
  assert.strictEqual(run.mode, "autonomous");
  const memory = store.snapshot();
  assert.ok(memory.goals.length >= 3);
  assert.ok(memory.runs.length >= 1);
  console.log("zoz-memory.test.js: PASS");
})().catch(error => { console.error(error); process.exit(1); });
