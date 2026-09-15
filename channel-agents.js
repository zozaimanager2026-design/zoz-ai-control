const crypto = require("crypto");
const now = () => new Date().toISOString();
const id = (p) => `${p}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { text: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, body };
  } finally { clearTimeout(timer); }
}

function youtubeConfigured() {
  return Boolean(process.env.YOUTUBE_ACCESS_TOKEN);
}

async function youtubeResearch(query, maxResults = 5) {
  if (!youtubeConfigured()) return { ok: false, configured: false, reason: "YOUTUBE_ACCESS_TOKEN_missing" };
  const params = new URLSearchParams({ part: "snippet", q: String(query), type: "video", maxResults: String(Math.min(25, maxResults)), order: "relevance" });
  const r = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`, { headers: { Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}` } });
  if (!r.ok) return { ok: false, configured: true, status: r.status, reason: "youtube_search_failed" };
  return { ok: true, items: (r.body.items || []).map(x => ({ id: x.id?.videoId, title: x.snippet?.title, description: x.snippet?.description, channel: x.snippet?.channelTitle, publishedAt: x.snippet?.publishedAt })) };
}

async function generateText(prompt) {
  const endpoint = process.env.ZOZ_AI_API_URL || process.env.OPENAI_COMPATIBLE_API_URL;
  const key = process.env.ZOZ_AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!endpoint || !key) return { ok: false, configured: false, reason: "ZOZ_AI_API_URL_and_ZOZ_AI_API_KEY_missing" };
  const r = await fetchJson(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.ZOZ_AI_MODEL || "gpt-4.1-mini", messages: [{ role: "system", content: "You are ZOZ AI's autonomous content operator. Produce useful, original, factual business content. Never invent product specifications." }, { role: "user", content: prompt }], temperature: 0.7 }) });
  if (!r.ok) return { ok: false, configured: true, status: r.status, reason: "ai_generation_failed" };
  const text = r.body?.choices?.[0]?.message?.content || r.body?.output_text || r.body?.text || "";
  return text ? { ok: true, text } : { ok: false, configured: true, reason: "ai_generation_empty" };
}

async function youtubeChannelState() {
  if (!youtubeConfigured()) return { configured: false, status: "needs_setup" };
  const r = await fetchJson("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}` } });
  return r.ok ? { configured: true, status: "verified", channel: r.body.items?.[0] || null } : { configured: true, status: "error", httpStatus: r.status };
}

async function runYouTubeAgent(memoryStore) {
  const state = await youtubeChannelState();
  await memoryStore.setChannel("youtube", { ...state, lastCheckedAt: now() });
  if (!state.configured || state.status !== "verified") return { ok: false, stage: "connection", ...state };

  const memory = await memoryStore.load();
  const existing = memory.content.find(x => x.goalKey === "youtube_growth" && ["planned", "draft", "ready"].includes(x.status));
  if (existing) return { ok: true, stage: "already_planned", contentId: existing.id };

  const research = await youtubeResearch(process.env.ZOZ_YOUTUBE_RESEARCH_QUERY || "أدوات كهربائية صيانة كهرباء نصائح", 8);
  if (!research.ok) return research;
  const titles = research.items.map(x => `- ${x.title}`).join("\n");
  const generated = await generateText(`ابحث بناءً على عناوين YouTube التالية، ثم اقترح فكرة فيديو/Short أصلية للقناة. أعطِ عنوانًا، زاوية، hook، نصًا قصيرًا، CTA، ووصفًا.\n${titles}`);
  if (!generated.ok) {
    const fallback = { id: id("content"), goalKey: "youtube_growth", status: "planned", title: research.items[0]?.title || "فكرة محتوى كهرباء", research, createdAt: now(), note: "AI generation adapter is not configured yet" };
    await memoryStore.remember("content", fallback);
    return { ok: true, stage: "research_saved", contentId: fallback.id, generation: generated };
  }
  const item = { id: id("content"), goalKey: "youtube_growth", status: "draft", title: "ZOZ AI YouTube draft", body: generated.text, research, createdAt: now() };
  await memoryStore.remember("content", item);
  return { ok: true, stage: "draft_created", contentId: item.id };
}

async function runLeadAgent(memoryStore) {
  const memory = await memoryStore.load();
  const open = memory.opportunities.filter(x => ["new", "qualified", "active"].includes(x.status) && x.goalKey === "lead_generation");
  if (open.length) return { ok: true, stage: "existing_opportunities", count: open.length };
  const query = process.env.ZOZ_LEAD_RESEARCH_QUERY || "محلات أدوات كهربائية مقاول كهرباء تشطيبات القاهرة";
  const endpoint = process.env.ZOZ_SEARCH_API_URL;
  const key = process.env.ZOZ_SEARCH_API_KEY;
  if (!endpoint || !key) return { ok: false, stage: "research", reason: "ZOZ_SEARCH_API_URL_and_ZOZ_SEARCH_API_KEY_missing" };
  const r = await fetchJson(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, limit: 10 }) });
  if (!r.ok) return { ok: false, stage: "research", reason: "lead_search_failed", status: r.status };
  const leads = Array.isArray(r.body?.results) ? r.body.results : [];
  for (const lead of leads) await memoryStore.remember("opportunities", { goalKey: "lead_generation", status: "new", source: lead.source || "search", title: lead.title || lead.name || "Lead", contact: lead.phone || lead.email || lead.url || null, evidence: lead, discoveredAt: now() });
  return { ok: true, stage: "leads_saved", count: leads.length };
}

async function executeAutonomousAgents(memoryStore) {
  const results = [];
  results.push({ agent: "youtube", result: await runYouTubeAgent(memoryStore) });
  results.push({ agent: "lead_generation", result: await runLeadAgent(memoryStore) });
  await memoryStore.recordRun({ id: id("agent_run"), mode: "autonomous_agents", results, completedAt: now() });
  return results;
}

module.exports = { runYouTubeAgent, runLeadAgent, executeAutonomousAgents, youtubeResearch, youtubeChannelState };
