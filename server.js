const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ZOZ_NAME = process.env.ZOZ_NAME || "ZOZ AI";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const state = {
  name: ZOZ_NAME,
  status: "running",
  autonomy: true,
  financialApprovalRequired: true,
  jobs: [],
  connectors: {
    github: { status: "connected" },
    vercel: { status: "needs_setup" },
    database: { status: "needs_setup" },
    whatsapp: { status: "needs_setup" },
    youtube: { status: "needs_setup" },
    tiktok: { status: "needs_setup" },
    linkedin: { status: "needs_setup" },
    shopify: { status: "needs_setup" }
  }
};

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
    time: new Date().toISOString()
  });
});

app.get("/api/state", (req, res) => {
  res.json(state);
});

app.get("/api/jobs", (req, res) => {
  res.json(state.jobs);
});

app.post("/api/jobs", (req, res) => {
  const { title, description = "" } = req.body;

  if (!title) {
    return res.status(400).json({
      error: "عنوان المهمة مطلوب"
    });
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

  res.status(201).json(job);
});

app.post("/api/jobs/:id/approve", (req, res) => {
  const job = state.jobs.find((item) => item.id === req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "المهمة غير موجودة"
    });
  }

  job.status = "approved";
  job.approvedAt = new Date().toISOString();

  app.get("/{*splat}", (req, res) => {


app.post("/api/jobs/:id/reject", (req, res) => {
  const job = state.jobs.find((item) => item.id === req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "المهمة غير موجودة"
    });
  }

  job.status = "rejected";
  job.rejectedAt = new Date().toISOString();

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
  res.json(state.connectors);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`${ZOZ_NAME} running on port ${PORT}`);
});
