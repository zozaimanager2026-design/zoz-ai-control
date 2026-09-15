const now = () => new Date().toISOString();

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { text: text.slice(0, 500) }; }
    return { ok: response.ok, status: response.status, body };
  } finally { clearTimeout(timer); }
}

function rendererConfigured() {
  return Boolean(process.env.J2V_API_KEY || process.env.JSON2VIDEO_API_KEY);
}

function extractNarration(content) {
  const text = String(content.body || "").replace(/```[\s\S]*?```/g, "").trim();
  return text.slice(0, 4500) || String(content.title || "ZOZ AI");
}

function movieFor(content) {
  const narration = extractNarration(content);
  const title = String(content.title || "ZOZ AI").slice(0, 140);
  return {
    resolution: "full-hd",
    quality: "high",
    cache: true,
    scenes: [{
      comment: "ZOZ AI autonomous short",
      elements: [
        { type: "text", text: title, style: "001", settings: { "font-size": "56px", "font-weight": "700", "vertical-position": "top", "horizontal-position": "center" } },
        { type: "voice", text: narration, model: process.env.J2V_VOICE_MODEL || "azure", voice: process.env.J2V_VOICE || "ar-SA-HamedNeural" },
        { type: "subtitles", language: "ar", settings: { "font-size": "42px", "font-weight": "700", "vertical-position": "bottom", "horizontal-position": "center" } }
      ]
    }]
  };
}

async function submitRender(content) {
  const apiKey = process.env.J2V_API_KEY || process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) return { ok: false, stage: "needs_renderer", reason: "J2V_API_KEY_missing" };
  const response = await fetchJson("https://api.json2video.com/v2/movies", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(movieFor(content))
  });
  if (!response.ok || !response.body?.project) return { ok: false, stage: "render_submit_failed", status: response.status, response: response.body };
  return { ok: true, stage: "render_submitted", projectId: response.body.project, submittedAt: now() };
}

async function pollRender(projectId) {
  const apiKey = process.env.J2V_API_KEY || process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) return { ok: false, stage: "needs_renderer", reason: "J2V_API_KEY_missing" };
  const response = await fetchJson(`https://api.json2video.com/v2/movies?project=${encodeURIComponent(projectId)}`, { headers: { "x-api-key": apiKey } });
  if (!response.ok) return { ok: false, stage: "render_poll_failed", status: response.status, response: response.body };
  const movie = response.body?.movie || {};
  if (movie.status === "done" && movie.url) return { ok: true, stage: "render_ready", videoUrl: movie.url, movie };
  if (["error", "timeout"].includes(movie.status)) return { ok: false, stage: "render_failed", status: movie.status, movie };
  return { ok: true, stage: "render_pending", status: movie.status || "processing", movie };
}

async function runMediaProductionAgent(memoryStore) {
  const memory = await memoryStore.load();
  const active = memory.content.filter(x => x.goalKey === "youtube_growth" && !["published", "failed"].includes(x.status));
  const pendingRender = active.find(x => x.renderProjectId && !x.videoUrl);
  if (pendingRender) {
    const polled = await pollRender(pendingRender.renderProjectId);
    if (polled.stage === "render_ready") {
      await memoryStore.remember("content", { ...pendingRender, status: "ready", videoUrl: polled.videoUrl, renderStatus: "done", renderedAt: now() });
      return { ok: true, stage: "render_ready", contentId: pendingRender.id, videoUrl: polled.videoUrl };
    }
    if (polled.stage === "render_failed") {
      await memoryStore.remember("content", { ...pendingRender, status: "failed", renderStatus: polled.status, renderError: polled.movie?.message || null, failedAt: now() });
    }
    return { ok: polled.ok, stage: polled.stage, contentId: pendingRender.id, status: polled.status || null };
  }
  const draft = active.find(x => ["planned", "draft"].includes(x.status));
  if (!draft) return { ok: true, stage: "no_content_to_render" };
  if (!rendererConfigured()) return { ok: false, stage: "needs_renderer", reason: "J2V_API_KEY_missing", contentId: draft.id };
  const submitted = await submitRender(draft);
  if (!submitted.ok) return { ...submitted, contentId: draft.id };
  await memoryStore.remember("content", { ...draft, status: "rendering", renderProjectId: submitted.projectId, renderSubmittedAt: submitted.submittedAt });
  return { ok: true, stage: "render_submitted", contentId: draft.id, projectId: submitted.projectId };
}

module.exports = { runMediaProductionAgent, rendererConfigured, movieFor, submitRender, pollRender };
