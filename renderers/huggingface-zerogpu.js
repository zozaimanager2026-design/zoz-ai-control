// ZOZ Hugging Face ZeroGPU Adapter — provider-neutral Gradio transport.
// Supports public ZeroGPU Spaces and an optional private/owned Space.
// Default profile matches the official Qwen/Qwen-Image Space API.

function timeoutSignal(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(ms) : undefined;
}

function config() {
  return {
    enabled: Boolean(process.env.ZOZ_HF_SPACE_URL),
    spaceUrl: String(process.env.ZOZ_HF_SPACE_URL || "").replace(/\/$/, ""),
    apiName: String(process.env.ZOZ_HF_API_NAME || "infer"),
    profile: String(process.env.ZOZ_HF_PROFILE || "qwen-image"),
    model: String(process.env.ZOZ_HF_MODEL || "Qwen/Qwen-Image-2512"),
    timeoutMs: Number(process.env.ZOZ_HF_TIMEOUT_MS || 180000),
    tokenConfigured: Boolean(process.env.HF_TOKEN),
    publicSpaceSupported: true,
    note: "Free ZeroGPU quota is provider-side and may be limited; no paid provider is required."
  };
}

function headers() {
  return process.env.HF_TOKEN
    ? { Authorization: "Bearer " + process.env.HF_TOKEN }
    : {};
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

function buildData(input = {}) {
  const profile = String(process.env.ZOZ_HF_PROFILE || "qwen-image-2512").toLowerCase();
  const prompt = String(input.prompt || input.description || input.title || "").trim();
  const negative = String(input.negativePrompt || "");
  const width = clampInt(input.width, 1024, 256, 1536);
  const height = clampInt(input.height, 1024, 256, 1536);
  const steps = clampInt(input.steps, 4, 1, 50);
  const seed = input.seed == null || Number(input.seed) < 0
    ? 42
    : clampInt(input.seed, 42, 0, 2147483647);

  // Official Qwen/Qwen-Image-2512 Space currently exposes:
  // infer(prompt, seed, randomize_seed, aspect_ratio, guidance_scale,
  //       num_inference_steps, prompt_enhance)
  // Prompt enhancement calls DashScope in that Space, so ZOZ disables it
  // by default to keep the renderer self-contained and credential-free.
  if (profile === "qwen-image-2512") {
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
    return [
      prompt,
      seed,
      input.seed == null || Number(input.seed) < 0,
      ratio,
      Number(input.guidanceScale ?? 4),
      steps,
      false
    ];
  }

  // Official Qwen/Qwen-Image legacy Space profile:
  // infer(prompt, negative_prompt, seed, randomize_seed, width, height,
  //       num_inference_steps, true_cfg_scale, distilled_cfg_scale)
  if (profile === "qwen-image") {
    return [
      prompt,
      negative,
      seed,
      input.seed == null || Number(input.seed) < 0,
      width,
      height,
      steps,
      Number(input.guidanceScale ?? 4),
      Number(input.distilledGuidanceScale ?? 1)
    ];
  }

  // Generic fallback profile for simple Spaces exposing the same common
  // text-to-image shape used by many Gradio demos.
  return [
    prompt,
    negative,
    width,
    height,
    steps,
    Number(input.guidanceScale ?? 4),
    input.seed == null ? -1 : Number(input.seed)
  ];
}

async function postQueue(spaceUrl, apiName, data) {
  const response = await fetch(
    spaceUrl + "/gradio_api/call/" + encodeURIComponent(apiName),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ data }),
      signal: timeoutSignal(Number(process.env.ZOZ_HF_ENQUEUE_TIMEOUT_MS || 30000))
    }
  );
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { response, body };
}

function extractEventPayload(data) {
  const lines = String(data || "").split(/\r?\n/);
  const payloads = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw) continue;
    try { payloads.push(JSON.parse(raw)); } catch {}
  }
  return payloads.length ? payloads[payloads.length - 1] : null;
}

function findImageValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return { url: value };
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findImageValue(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    const url = value.url || value.path || value.image_url;
    if (url) return {
      url: String(value.url || ""),
      path: String(value.path || ""),
      filename: value.orig_name || value.filename || null,
      mimeType: value.mime_type || value.mimeType || null
    };
    for (const nested of Object.values(value)) {
      const hit = findImageValue(nested);
      if (hit) return hit;
    }
  }
  return null;
}

function extractSeed(value) {
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) {
      const n = Number(value[i]);
      if (Number.isInteger(n) && n >= 0) return n;
    }
  }
  return null;
}

async function pollResult(spaceUrl, eventId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;

  while (Date.now() < deadline) {
    const response = await fetch(
      spaceUrl + "/gradio_api/call/" + encodeURIComponent(process.env.ZOZ_HF_API_NAME || "infer") + "/" + encodeURIComponent(eventId),
      {
        method: "GET",
        headers: { Accept: "text/event-stream", ...headers() },
        signal: timeoutSignal(Math.min(30000, Math.max(5000, deadline - Date.now())))
      }
    );
    lastStatus = response.status;
    const data = await response.text();
    const payload = extractEventPayload(data);

    if (payload === "error" || payload?.type === "error") {
      return { ok: false, status: "failed", reason: "zerogpu_generation_error", httpStatus: response.status };
    }

    const image = findImageValue(payload);
    if (image) {
      return {
        ok: true,
        executionMode: "huggingface-zerogpu",
        renderer: "zoz-huggingface-zerogpu",
        model: process.env.ZOZ_HF_MODEL || "Qwen/Qwen-Image-2512",
        device: "cuda",
        imageUrl: image.url || null,
        path: image.path || null,
        filename: image.filename || null,
        mimeType: image.mimeType || null,
        seed: extractSeed(payload)
      };
    }

    await new Promise(resolve => setTimeout(resolve, 750));
  }

  return { ok: false, status: "failed", reason: "zerogpu_timeout", httpStatus: lastStatus };
}

async function generateViaZeroGPU(input = {}) {
  const cfg = config();
  if (!cfg.spaceUrl) return { ok: false, status: "blocked", reason: "ZOZ_HF_SPACE_URL_missing" };

  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return { ok: false, status: "blocked", reason: "image_prompt_required" };

  try {
    const queued = await postQueue(cfg.spaceUrl, cfg.apiName, buildData(input));
    if (queued.response.status < 200 || queued.response.status >= 300 || !queued.body.event_id) {
      return {
        ok: false,
        status: "failed",
        reason: "zerogpu_enqueue_failed",
        httpStatus: queued.response.status,
        detail: queued.body?.error || null
      };
    }

    const result = await pollResult(cfg.spaceUrl, queued.body.event_id, cfg.timeoutMs);
    if (result.ok) result.requestId = queued.body.event_id;
    return result;
  } catch (error) {
    if (error?.name === "AbortError" || /timeout/i.test(String(error?.message || ""))) {
      return { ok: false, status: "failed", reason: "zerogpu_timeout", detail: error.message };
    }
    return { ok: false, status: "unavailable", reason: "zerogpu_unreachable", detail: error.message };
  }
}

module.exports = { config, generateViaZeroGPU, buildData, findImageValue };
