const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ZOZ_NAME = process.env.ZOZ_NAME || "ZOZ AI";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Durable persistence is enabled only when both REST URL and token exist.
const persistence = {
  enabled: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  key: process.env.ZOZ_STATE_KEY || "zoz-ai:state"
};

const connectorConfig = {
  github: { status: "connected", label: "GitHub" },
  vercel: { status: "deployed", label: "Vercel" },
  database: { status: persistence.enabled ? "connected" : "needs_setup", label: "Database" },
  whatsapp: { status: process.env.WHATSAPP_ACCESS_TOKEN ? "connected" : "needs_setup", label: "WhatsApp" },
  youtube: { status: process.env.YOUTUBE_ACCESS_TOKEN ? "connected" : "needs_setup", label: "YouTube" },
  tiktok: { status: process.env.TIKTOK_ACCESS_TOKEN ? "connected" : "needs_setup", label: "TikTok" },
  linkedin: { status: process.env.LINKEDIN_ACCESS_TOKEN ? "connected" : "needs_setup", label: "LinkedIn" },
  shopify: { status: process.env.SHOPIFY_ACCESS_TOKEN ? "connected" : "needs_setup", label: "Shopify" }
};

const state = {
  name: ZOZ_NAME,
  status: "running",
  autonomy: true,
  financialApprovalRequired: true,
  jobs: [],
  connectors: connectorConfig
};

async function kvGet(key) {
  if (!persistence.enabled) return null;
  const base = process.env.KV_REST_API_URL.replace(/\/$/, "");
  const response = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Persistence GET failed: ${response.status}`);
  return response.json();
}

async function kvSet(key, value) {
  if (!persistence.enabled) return null;
  const base = process.env.KV_REST_API_URL.replace(/\/$/, "");
  const response = await fetch(`${base}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(value)
  });
  if (!response.ok) throw new Error(`Persistence SET failed: ${response.status}`);
  return response.json().catch(() => null);
}

async function loadState() {
  if (!persistence.enabled) return;
  try {
    const result = await kvGet(persistence.key);
    if (result && result.result) {
      const saved = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
      if (saved && typeof saved === "object") state.jobs = Array.isArray(saved.jobs) ? saved.jobs : [];
    }
  } catch (error) {
    console.error("State load warning:", error.message);
  }
}

async function saveState() {
  if (!persistence.enabled) return;
  try {
    await kvSet(persistence.key, { ...state, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State save warning:", error.message);
  }
}

function isFinanciallySensitive(text = "") {
  return /دفع|شراء|تحويل|سحب|استلام أموال|استلام اموال|بنك|بطاقة|bank|card|payment|purchase|transfer|withdraw/i.test(text);
}

function readiness() {
  const blockers = [];
  if (!persistence.enabled) {
    blockers.push({ id: "database", status: "needs_setup", priority: 1, owner: "user", action: "إضافة KV_REST_API_URL وKV_REST_API_TOKEN إلى Production Environment Variables" });
  }
  for (const [key, label] of [
    ["whatsapp", "WhatsApp"],
    ["youtube", "YouTube"],
    ["tiktok", "TikTok"],
    ["linkedin", "LinkedIn"],
    ["shopify", "Shopify"]
  ]) {
    if (state.connectors[key].status === "needs_setup") {
      blockers.push({ id: key, status: "needs_setup", priority: key === "whatsapp" ? 2 : 3, owner: "user", action: `إكمال اعتماد ${label} قبل تشغيله آليًا` });
    }
  }
  blockers.sort((a, b) => a.priority - b.priority);
  return {
    ok: blockers.length === 0,
    service: ZOZ_NAME,
    core: "healthy",
    persistence: persistence.enabled ? "enabled" : "memory_only",
    financialApprovalRequired: true,
    blockers
  };
}

function executionPlan() {
  const r = readiness();
  return {
    service: ZOZ_NAME,
    mode: "ordered_execution",
    rule: "نفّذ تلقائيًا ما يمكن تنفيذه بأمان؛ أوقف فقط عند اعتماد/سر/قرار مالي مطلوب من المستخدم",
    completed: [
      "core_health",
      "github_repository",
      "vercel_deployment",
      "readiness_dashboard",
      "financial_approval_gate"
    ],
    next: r.blockers.map((b, index) => ({ step: index + 1, ...b })),
    user_action_required: r.blockers.filter((b) => b.owner === "user").map((b) => b.id),
    financial_actions_blocked: true
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: ZOZ_NAME, status: "healthy", persistence: persistence.enabled ? "enabled" : "memory_only", time: new Date().toISOString() });
});

app.get("/api/state", (req, res) => {
  res.json({ ...state, persistence: { enabled: persistence.enabled, provider: persistence.enabled ? "KV-compatible REST" : "memory" } });
});

app.get("/api/readiness", (req, res) => res.json(readiness()));
app.get("/api/plan", (req, res) => res.json(executionPlan()));

app.get("/api/jobs", (req, res) => res.json(state.jobs));

app.post("/api/jobs", async (req, res) => {
  const { title, description = "" } = req.body;
  if (!title) return res.status(400).json({ error: "عنوان المهمة مطلوب" });
  const financial = isFinanciallySensitive(`${title} ${description}`);
  const job = {
    id: Date.now().toString(),
    title,
    description,
    financial,
    status: financial ? "approval_required" : "pending",
    createdAt: new Date().toISOString()
  };
  state.jobs.push(job);
  await saveState();
  res.status(201).json(job);
});

app.post("/api/jobs/:id/approve", async (req, res) => {
  const job = state.jobs.find((item) => item.id === req.params.id);
  if (!job) return res.status(404).json({ error: "المهمة غير موجودة" });
  job.status = "approved";
  job.approvedAt = new Date().toISOString();
  await saveState();
  res.json(job);
});

app.post("/api/jobs/:id/reject", async (req, res) => {
  const job = state.jobs.find((item) => item.id === req.params.id);
  if (!job) return res.status(404).json({ error: "المهمة غير موجودة" });
  job.status = "rejected";
  job.rejectedAt = new Date().toISOString();
  await saveState();
  res.json(job);
});

// Safe internal execution marker. It never performs a payment, purchase,
// transfer, withdrawal, or money-receiving action.
app.post("/api/jobs/:id/execute", async (req, res) => {
  const job = state.jobs.find((item) => item.id === req.params.id);
  if (!job) return res.status(404).json({ error: "المهمة غير موجودة" });
  if (job.financial) return res.status(403).json({ error: "موافقة المستخدم مطلوبة قبل تنفيذ مهمة مالية", status: "approval_required" });
  if (!["pending", "approved"].includes(job.status)) return res.status(409).json({ error: "المهمة ليست قابلة للتنفيذ", status: job.status });
  job.status = "executed";
  job.executedAt = new Date().toISOString();
  job.executionMode = "safe_internal_marker";
  await saveState();
  res.json({ ok: true, job, note: "تم تسجيل التنفيذ الداخلي فقط؛ لا يوجد إجراء مالي أو خارجي تلقائي هنا." });
});

app.post("/api/replies/preview", (req, res) => {
  const { text = "" } = req.body;
  res.json({ text, financialApprovalRequired: isFinanciallySensitive(text), ready: true });
});

app.get("/api/connectors/status", (req, res) => {
  res.json({
    ...state.connectors,
    summary: {
      connected: Object.values(state.connectors).filter((x) => x.status === "connected").length,
      deployed: Object.values(state.connectors).filter((x) => x.status === "deployed").length,
      needsSetup: Object.values(state.connectors).filter((x) => x.status === "needs_setup").length
    },
    persistence: { enabled: persistence.enabled, provider: persistence.enabled ? "KV-compatible REST" : "memory" }
  });
});

app.get("/api/connectors/requirements", (req, res) => {
  res.json({
    github: "متصل عبر GitHub Connector",
    vercel: "النظام منشور على Vercel؛ ربط Vercel MCP داخل ChatGPT منفصل عن نشر الموقع",
    database: "KV_REST_API_URL + KV_REST_API_TOKEN",
    whatsapp: "WHATSAPP_ACCESS_TOKEN",
    youtube: "YOUTUBE_ACCESS_TOKEN",
    tiktok: "TIKTOK_ACCESS_TOKEN",
    linkedin: "LINKEDIN_ACCESS_TOKEN",
    shopify: "SHOPIFY_ACCESS_TOKEN",
    financialRule: "لا يتم الدفع أو الشراء أو التحويل أو استلام الأموال دون موافقة المستخدم"
  });
});

app.get("/{*splat}", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

loadState().finally(() => {
  app.listen(PORT, () => console.log(`${ZOZ_NAME} running on port ${PORT}`));
});
