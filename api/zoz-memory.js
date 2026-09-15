const { createMemoryStore } = require("../zoz-memory");
const { financial } = require("../autonomy-core");

module.exports = async function handler(req, res) {
  const store = createMemoryStore();
  await store.init();
  if (req.method === "GET") return res.status(200).json({ ok: true, durable: store.durable, memory: store.snapshot() });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const { type, data } = req.body || {};
  if (!type || !data || typeof data !== "object") return res.status(400).json({ ok: false, error: "type_and_data_required" });
  if (financial(JSON.stringify(data))) return res.status(403).json({ ok: false, error: "financial_approval_required" });
  const item = await store.remember(type, data);
  return res.status(201).json({ ok: true, item, durable: store.durable });
};
