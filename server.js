const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ZOZ_NAME = process.env.ZOZ_NAME || "ZOZ AI";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const connectorConfig = {
  github: { status: "connected", label: "GitHub" },
  vercel: { status: process.env.VERCEL ? "deployed" : "needs_setup", label: "Vercel" },
  database: {
    status: process.env.DATABASE_URL || process.env.KV_REST_API_URL ? "connected" : "needs_setup",
    label: "Database"
  },
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

const persistence = {
  enabled: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  key: process.env.ZOZ_STATE_KEY || "zoz-ai:state"
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
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  const response = await fetch(`${base}/set/${encodeURIComponent(key)}/${encodedValue}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
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
      if (saved && typeof saved === "object") {
        state.jobs = Array.isArray(saved.jobs) ? saved.jobs : [];
      }
    }
  } catch (error) {
    console.error("State load warning:", error.message);
  }
}

async function saveState() {
  if (!persistence.enabled) return;

  try {
    await kvSet(persistence.key, {
      ...state,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("State save warning:", error.message);
  }
}

function isFinanciallySensitive(text = "") {
  return /دفع|شراء|تحويل|سحب|استلام أموال|استلام اموال|بنك|بطاقة|bank|card|payment|purchase|transfer|withdraw/i.test(
    text
  );
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: ZOZ_NAME,
    status: "healthy",
    persistence: persistence.enabled ? "enabled" : "memory_only",
    time: new Date().toISOString()
  });
});

app.get("/api/state", (req, res) => {
  res.json({
    ...state,
    persistence: {
      enabled: persistence.enabled,
      provider: persistence.enabled ? "KV-compatible REST" : "memory"
    }
  });
});

app.get("/api/jobs", (req, res) => {
  res.json(state.jobs);
});

app.post("/api/jobs", async (req, res) => {
  const { title, description = "" } = req.body;

  if (!title) {
    return res.status(400).json({ error: "عنوان المهمة مطلوب" });
  }

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

app.post("/api/replies/preview", (req, res) => {
  const { text = "" } = req.body;
  res.json({
    text,
    financialApprovalRequired: isFinanciallySensitive(text),
    ready: true
  });
});

app.get("/api/connectors/status", (req, res) => {
  res.json({
    ...state.connectors,
    summary: {
      connected: Object.values(state.connectors).filter((x) => x.status === "connected").length,
      deployed: Object.values(state.connectors).filter((x) => x.status === "deployed").length,
      needsSetup: Object.values(state.connectors).filter((x) => x.status === "needs_setup").length
    },
    persistence: {
      enabled: persistence.enabled,
      provider: persistence.enabled ? "KV-compatible REST" : "memory"
    }
  });
});

app.get("/api/connectors/requirements", (req, res) => {
  res.json({
    github: "متصل عبر GitHub Connector",
    vercel: "النظام منشور على Vercel؛ ربط Vercel MCP داخل ChatGPT منفصل عن نشر الموقع",
    database: "DATABASE_URL أو KV_REST_API_URL + KV_REST_API_TOKEN",
    whatsapp: "WHATSAPP_ACCESS_TOKEN",
    youtube: "YOUTUBE_ACCESS_TOKEN",
    tiktok: "TIKTOK_ACCESS_TOKEN",
    linkedin: "LINKEDIN_ACCESS_TOKEN",
    shopify: "SHOPIFY_ACCESS_TOKEN",
    financialRule: "لا يتم الدفع أو الشراء أو التحويل أو استلام الأموال دون موافقة المستخدم"
  });
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

loadState().finally(() => {
  app.listen(PORT, () => {
    console.log(`${ZOZ_NAME} running on port ${PORT}`);
  });
});
