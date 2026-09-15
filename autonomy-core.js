const crypto = require("crypto");

const FINANCIAL = /دفع|شراء|تحويل|سحب|استلام\s*أموال|استلام\s*اموال|بنك|بطاقة|payment|purchase|transfer|withdraw|receive\s+money/i;
const now = () => new Date().toISOString();
const id = (p) => `${p}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

function financial(text = "") { return FINANCIAL.test(String(text)); }

function createAutonomyCore(memoryStore) {
  const defaults = [
    { key: "business_growth", title: "تنمية الأعمال", status: "active", priority: 100 },
    { key: "youtube_growth", title: "تنمية قناة YouTube بالمحتوى", status: "active", priority: 90 },
    { key: "lead_generation", title: "اكتشاف عملاء وفرص حقيقية", status: "active", priority: 90 }
  ];

  async function ensureGoals() {
    const memory = await memoryStore.load();
    const existing = new Set(memory.goals.map(g => g.key));
    for (const goal of defaults) if (!existing.has(goal.key)) await memoryStore.remember("goals", goal);
  }

  async function proposeAction(action) {
    const text = `${action.title || ""} ${action.description || ""}`;
    return {
      id: id("action"),
      ...action,
      status: financial(text) ? "approval_required" : "ready",
      humanApprovalRequired: financial(text),
      autonomous: !financial(text),
      createdAt: now()
    };
  }

  async function heartbeat(context = {}) {
    await ensureGoals();
    const memory = await memoryStore.load();
    const run = { id: id("heartbeat"), mode: "autonomous", startedAt: now(), goals: memory.goals.filter(g => g.status === "active").map(g => g.key), actions: [], blockers: [] };

    // The core does not fabricate external results. It creates durable work intents that channel executors can fulfill.
    const existingOpen = new Set(memory.opportunities.filter(x => ["new","qualified","active"].includes(x.status)).map(x => x.goalKey));
    if (!existingOpen.has("lead_generation")) run.actions.push(await proposeAction({ type: "research_leads", goalKey: "lead_generation", title: "البحث عن فرص عملاء حقيقية", description: "ابحث عن فرص مناسبة وسجلها في الذاكرة المستقلة مع مصدر ودرجة ثقة." }));
    if (!memory.content.some(x => x.goalKey === "youtube_growth" && ["planned","draft","ready"].includes(x.status))) run.actions.push(await proposeAction({ type: "content_research", goalKey: "youtube_growth", title: "البحث عن موضوع YouTube قابل للتنفيذ", description: "حلل موضوعات المحتوى المطلوبة، ثم أنشئ فكرة قابلة للإنتاج مع سبب الاختيار." }));

    run.context = context;
    run.completedAt = now();
    await memoryStore.recordRun(run);
    return run;
  }

  return { ensureGoals, proposeAction, heartbeat };
}

module.exports = { createAutonomyCore, financial };
