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

function uploadPostConfigured() {
  return Boolean(process.env.UPLOAD_POST_API_KEY);
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
        { type: "text", text: title, style: "001", settings: { "font-size": 56, "font-weight": 700, "vertical-position": "top", "horizontal-position": "center" } },
        { type: "voice", text: narration, model: process.env.J2V_VOICE_MODEL || "azure", voice: process.env.J2V_VOICE || "ar-SA-HamedNeural" },
        { type: "subtitles", language: "ar", settings: { "font-size": 42, "font-weight": 700, "vertical-position": "bottom", "horizontal-position": "center" } }
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
  if (!response.ok || !response.body?.project) {
    return { ok: false, stage: "render_submit_failed", status: response.status, reason: response.body?.message || response.body?.error || response.body?.text || "json2video_submit_failed", response: response.body };
  }
  return { ok: true, stage: "render_submitted", projectId: response.body.project, submittedAt: now() };
}

async function pollRender(projectId) {
  const apiKey = process.env.J2V_API_KEY || process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) return { ok: false, stage: "needs_renderer", reason: "J2V_API_KEY_missing" };
  const response = await fetchJson(`https://api.json2video.com/v2/movies?project=${encodeURIComponent(projectId)}`, { headers: { "x-api-key": apiKey } });
  if (!response.ok) return { ok: false, stage: "render_poll_failed", status: response.status, reason: response.body?.message || response.body?.error || response.body?.text || "json2video_poll_failed", response: response.body };
  const movie = response.body?.movie || {};
  if (movie.status === "done" && movie.url) return { ok: true, stage: "render_ready", videoUrl: movie.url, movie };
  if (["error", "timeout"].includes(movie.status)) return { ok: false, stage: "render_failed", status: movie.status, reason: movie.message || movie.error || "json2video_render_failed", movie };
  return { ok: true, stage: "render_pending", status: movie.status || "processing", movie };
}

async function publishWithUploadPost(content, videoUrl) {
  if (!uploadPostConfigured()) return { ok: false, stage: "needs_publisher", reason: "UPLOAD_POST_API_KEY_missing" };
  const profile = process.env.UPLOAD_POST_PROFILE || "ZozAI";
  const publicPublish = process.env.ZOZ_AUTO_PUBLISH_YOUTUBE === "true";
  const form = new FormData();
  form.append("video", videoUrl);
  form.append("user", profile);
  form.append("platform[]", "youtube");
  form.append("title", String(content.title || "ZOZ AI").slice(0, 100));
  form.append("description", String(content.body || content.title || "ZOZ AI").slice(0, 5000));
  form.append("youtube_title", String(content.title || "ZOZ AI").slice(0, 100));
  form.append("privacyStatus", publicPublish ? "public" : "private");
  form.append("async_upload", "true");
  form.append("external_id", String(content.id || `zoz-content-${Date.now()}`));
  const response = await fetchJson("https://api.upload-post.com/api/upload", { method: "POST", headers: { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY}` }, body: form });
  if (!response.ok) return { ok: false, stage: "publish_failed", status: response.status, reason: response.body?.message || response.body?.error || response.body?.text || "upload_post_publish_failed", response: response.body };
  const youtube = response.body?.results?.youtube || {};
  return { ok: youtube.success !== false, stage: youtube.success === false ? "publish_failed" : "publish_submitted", requestId: response.body?.request_id || response.body?.requestId || null, jobId: response.body?.job_id || response.body?.jobId || null, videoId: youtube.post_id || youtube.video_id || null, url: youtube.url || null, privacyStatus: publicPublish ? "public" : "private", response: response.body };
}

async function runMediaProductionAgent(memoryStore) {
  const memory = await memoryStore.load();
  const active = memory.content.filter(x => x.goalKey === "youtube_growth" && !["published"].includes(x.status));
  const pendingRender = active.find(x => x.renderProjectId && !x.videoUrl && x.status !== "failed");
  if (pendingRender) {
    const polled = await pollRender(pendingRender.renderProjectId);
    if (polled.stage === "render_ready") {
      let publication = null;
      if (process.env.ZOZ_AUTO_PUBLISH_YOUTUBE === "true") publication = await publishWithUploadPost(pendingRender, polled.videoUrl);
      const published = publication?.ok === true && ["publish_submitted", "published"].includes(publication.stage);
      await memoryStore.remember("content", { ...pendingRender, status: published ? "published" : "ready", videoUrl: polled.videoUrl, renderStatus: "done", renderedAt: now(), publication: publication || { stage: "publish_not_requested" } });
      return { ok: publication ? publication.ok : true, stage: published ? "published" : "render_ready", contentId: pendingRender.id, videoUrl: polled.videoUrl, publication };
    }
    if (polled.stage === "render_failed") {
      await memoryStore.remember("content", { ...pendingRender, status: "planned", renderProjectId: null, renderStatus: "retry_required", renderError: polled.reason || polled.movie?.message || null, retryAt: now() });
      return { ok: false, stage: "render_failed_retry_scheduled", contentId: pendingRender.id, status: polled.status || null, reason: polled.reason || null };
    }
    return { ok: polled.ok, stage: polled.stage, contentId: pendingRender.id, status: polled.status || null, reason: polled.reason || null };
  }
  const readyToPublish = active.find(x => x.videoUrl && ["ready", "render_ready"].includes(x.status));
  if (readyToPublish && process.env.ZOZ_AUTO_PUBLISH_YOUTUBE === "true") {
    const publication = await publishWithUploadPost(readyToPublish, readyToPublish.videoUrl);
    const published = publication.ok && ["publish_submitted", "published"].includes(publication.stage);
    if (published) await memoryStore.remember("content", { ...readyToPublish, status: "published", publication, publishedAt: now() });
    return { ok: publication.ok, stage: published ? "published" : publication.stage, contentId: readyToPublish.id, publication };
  }
  const draft = active.find(x => ["planned", "draft", "failed"].includes(x.status) && !x.renderProjectId);
  if (!draft) return { ok: true, stage: "no_content_to_render" };
  if (!rendererConfigured()) return { ok: false, stage: "needs_renderer", reason: "J2V_API_KEY_missing", contentId: draft.id };
  const submitted = await submitRender(draft);
  if (!submitted.ok) return { ...submitted, contentId: draft.id };
  await memoryStore.remember("content", { ...draft, status: "rendering", renderProjectId: submitted.projectId, renderSubmittedAt: submitted.submittedAt, renderStatus: "submitted" });
  return { ok: true, stage: "render_submitted", contentId: draft.id, projectId: submitted.projectId };
}

module.exports = { runMediaProductionAgent, rendererConfigured, movieFor, submitRender, pollRender, publishWithUploadPost };
