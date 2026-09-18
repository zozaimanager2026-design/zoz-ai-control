// ZOZ Vercel image generation function.
// Uses public Hugging Face ZeroGPU Spaces; no paid provider is required.
const SPACES = [
  {
    url: "https://qwen-qwen-image.hf.space",
    model: "Qwen/Qwen-Image",
    kind: "qwen-image",
  },
  {
    url: "https://qwen-qwen-image-2512.hf.space",
    model: "Qwen/Qwen-Image-2512",
    kind: "qwen-image-2512",
  },
];

export const config = {
  maxDuration: 300,
};

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

function buildData(input = {}, kind) {
  const prompt = String(input.prompt || input.description || input.title || "").trim();
  const width = clampInt(input.width, 1024, 256, 1536);
  const height = clampInt(input.height, 1024, 256, 1536);
  const seed = input.seed == null || Number(input.seed) < 0 ? 42 : clampInt(input.seed, 42, 0, 2147483647);
  const steps = clampInt(input.steps || input.num_inference_steps, kind === "qwen-image" ? 12 : 8, 1, 20);
  const guidance = Number(input.guidanceScale ?? input.guidance_scale ?? 4);

  const ratio = (() => {
    const r = width / Math.max(1, height);
    if (Math.abs(r - 16 / 9) < 0.08) return "16:9";
    if (Math.abs(r - 9 / 16) < 0.08) return "9:16";
    if (Math.abs(r - 4 / 3) < 0.08) return "4:3";
    if (Math.abs(r - 3 / 4) < 0.08) return "3:4";
    if (Math.abs(r - 3 / 2) < 0.08) return "3:2";
    if (Math.abs(r - 2 / 3) < 0.08) return "2:3";
    return "1:1";
  })();

  if (kind === "qwen-image") {
    return [prompt, "", seed, input.seed == null || Number(input.seed) < 0, ratio, guidance, steps, false];
  }
  return [prompt, seed, input.seed == null || Number(input.seed) < 0, ratio, guidance, steps, false];
}

async function readSse(response) {
  const text = await response.text();
  const events = [];
  for (const block of text.replace(/\r/g, "").split("\n\n")) {
    if (!block.trim()) continue;
    let event = null;
    let dataText = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataText += line.slice(5).trim();
    }
    let data = null;
    if (dataText) {
      try { data = JSON.parse(dataText); } catch { data = dataText; }
    }
    events.push({ event, data });
  }
  return events;
}

function findImage(value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return { url: value };
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImage(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const url = value.url || value.image_url || value.path;
    if (url) return {
      url: String(value.url || ""),
      path: String(value.path || ""),
      filename: value.orig_name || value.filename || null,
      mimeType: value.mime_type || value.mimeType || null,
    };
    for (const nested of Object.values(value)) {
      const found = findImage(nested);
      if (found) return found;
    }
  }
  return null;
}

async function runSpace(space, input) {
  const queue = await fetch(space.url + "/gradio_api/call/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: buildData(input, space.kind) }),
  });
  const queueText = await queue.text();
  let queued = {};
  try { queued = queueText ? JSON.parse(queueText) : {}; } catch {}

  if (!queue.ok || !queued.event_id) {
    return { ok: false, reason: "zerogpu_enqueue_failed", httpStatus: queue.status, detail: queueText.slice(0, 500), space: space.url };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);
  try {
    const result = await fetch(
      space.url + "/gradio_api/call/infer/" + encodeURIComponent(queued.event_id),
      { headers: { Accept: "text/event-stream" }, signal: controller.signal }
    );
    clearTimeout(timeout);
    const events = await readSse(result);
    const errorEvent = events.find(x => x.event === "error");
    if (errorEvent) {
      return {
        ok: false,
        reason: "zerogpu_generation_error",
        httpStatus: result.status,
        detail: errorEvent.data == null ? "ZeroGPU returned event:error with data:null." : String(errorEvent.data).slice(0, 500),
        quotaIndeterminate: true,
        space: space.url,
      };
    }
    const complete = events.find(x => x.event === "complete");
    const payload = complete?.data ?? events.map(x => x.data).find(Boolean);
    const image = findImage(payload);
    if (!image) {
      return { ok: false, reason: "zerogpu_complete_without_image", httpStatus: result.status, events: events.map(x => x.event), space: space.url };
    }
    return {
      ok: true,
      executionMode: "vercel-hf-zerogpu",
      provider: "huggingface-zerogpu",
      model: space.model,
      imageUrl: image.url || null,
      path: image.path || null,
      filename: image.filename || null,
      mimeType: image.mimeType || null,
      requestId: queued.event_id,
      space: space.url,
    };
  } catch (error) {
    clearTimeout(timeout);
    return { ok: false, reason: error?.name === "AbortError" ? "zerogpu_timeout" : "zerogpu_unreachable", detail: error.message, space: space.url };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) return res.status(403).json({ ok: false, error: "origin_not_allowed" });
    } catch {
      return res.status(403).json({ ok: false, error: "origin_not_allowed" });
    }
  }

  const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return res.status(400).json({ ok: false, error: "image_prompt_required" });

  const results = [];
  for (const space of SPACES) {
    const result = await runSpace(space, input);
    results.push(result);
    if (result.ok) return res.status(200).json(result);
    // Don't spend the second Space's quota when the first one clearly reports HTTP 429.
    if (result.httpStatus === 429) break;
  }
  return res.status(502).json({
    ok: false,
    reason: "all_free_renderers_failed",
    attempts: results,
    quotaNote: "ZeroGPU quotas are provider-side; 429 is treated as quota/rate limit.",
  });
}
