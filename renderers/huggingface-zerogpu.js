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
    model: String(process.env.ZOZ_HF_MODEL || "Qwen/Qwen-Image"),
    timeoutMs: Number(process.env.ZOZ_HF_TIMEOUT_MS || 300000),
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
  const profile = String(input.hfProfileOverride || process.env.ZOZ_HF_PROFILE || "qwen-image-2512").toLowerCase();
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

async function readSseEvents(response, onEvent) {
  if (!response.body) {
    const data = await response.text();
    const payload = extractEventPayload(data);
    if (payload !== null) await onEvent({ event: null, data: payload });
    return;
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary).replace(/\r/g, "");
      buffer = buffer.slice(boundary + 2);
      if (!block.trim()) continue;
      let event = null;
      let dataText = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataText += line.slice(5).trim();
      }
      let data = null;
      if (dataText) {
        try { data = JSON.parse(dataText); } catch { data = dataText; }
      }
      await onEvent({ event, data });
      if (event === "complete" || event === "error") return;
    }
  }
  const tail = buffer.replace(/\r/g, "").trim();
  if (tail) {
    let event = null;
    let dataText = "";
    for (const line of tail.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataText += line.slice(5).trim();
    }
    let data = null;
    if (dataText) {
      try { data = JSON.parse(dataText); } catch { data = dataText; }
    }
    await onEvent({ event, data });
  }
}

async function pollResult(spaceUrl, eventId, timeoutMs, apiName = process.env.ZOZ_HF_API_NAME || "infer", modelName = process.env.ZOZ_HF_MODEL || "Qwen/Qwen-Image-2512") {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  let lastEvent = null;

  while (Date.now() < deadline) {
    const response = await fetch(
      spaceUrl + "/gradio_api/call/" + encodeURIComponent(apiName) + "/" + encodeURIComponent(eventId),
      {
        method: "GET",
        headers: { Accept: "text/event-stream", ...headers() },
        signal: timeoutSignal(Math.min(245000, Math.max(10000, deadline - Date.now())))
      }
    );
    lastStatus = response.status;
    console.log("[ZOZ_HF_ZERO_GPU] stream", JSON.stringify({ eventId, httpStatus: response.status }));

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, status: "failed", reason: "zerogpu_result_http_error", httpStatus: response.status, detail: body.slice(0, 500) };
    }

    let completed = false;
    let completedPayload = null;
    let streamError = null;
    await readSseEvents(response, async ({ event, data }) => {
      lastEvent = event || lastEvent;
      console.log("[ZOZ_HF_ZERO_GPU] event", JSON.stringify({ eventId, event: event || null }));
      if (event === "error" || data === "error") {
        streamError = { event: event || "error", data };
        return;
      }
      if (event === "complete") {
        completed = true;
        completedPayload = data;
      } else if (event !== "heartbeat" && data != null) {
        const hit = findImageValue(data);
        if (hit) {
          completed = true;
          completedPayload = data;
        }
      }
    });

    if (streamError) {
      return {
        ok: false,
        status: "failed",
        reason: "zerogpu_generation_error",
        httpStatus: lastStatus,
        event: streamError.event || "error",
        detail: streamError.data == null ? "ZeroGPU returned event:error with no diagnostic payload (data:null)." : String(streamError.data).slice(0, 500),
        quotaIndeterminate: true
      };
    }

    if (completed) {
      const image = findImageValue(completedPayload);
      if (image) {
        return {
          ok: true,
          executionMode: "huggingface-zerogpu",
          renderer: "zoz-huggingface-zerogpu",
          model: modelName,
          device: "cuda",
          imageUrl: image.url || null,
          path: image.path || null,
          filename: image.filename || null,
          mimeType: image.mimeType || null,
          seed: extractSeed(completedPayload)
        };
      }
      return { ok: false, status: "failed", reason: "zerogpu_complete_without_image", httpStatus: lastStatus, event: lastEvent };
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return { ok: false, status: "failed", reason: "zerogpu_timeout", httpStatus: lastStatus, event: lastEvent };
}

async function generateAgainstSpace(input, overrides = {}) {
  const cfg = { ...config(), ...overrides };
  const queued = await postQueue(cfg.spaceUrl, cfg.apiName, buildData({ ...input, hfProfileOverride: cfg.profile }));
  if (queued.response.status < 200 || queued.response.status >= 300 || !queued.body.event_id) {
    return {
      ok: false,
      status: "failed",
      reason: "zerogpu_enqueue_failed",
      httpStatus: queued.response.status,
      detail: queued.body?.error || null,
      spaceUrl: cfg.spaceUrl
    };
  }
  const result = await pollResult(cfg.spaceUrl, queued.body.event_id, cfg.timeoutMs, cfg.apiName, cfg.model);
  if (result.ok) result.requestId = queued.body.event_id;
  result.spaceUrl = cfg.spaceUrl;
  return result;
}

async function generateViaZeroGPU(input = {}) {
  const cfg = config();
  if (!cfg.spaceUrl) return { ok: false, status: "blocked", reason: "ZOZ_HF_SPACE_URL_missing" };

  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return { ok: false, status: "blocked", reason: "image_prompt_required" };

  try {
    console.log("[ZOZ_HF_ZERO_GPU] primary attempt", JSON.stringify({ profile: cfg.profile, model: cfg.model, spaceUrl: cfg.spaceUrl }));
    const primary = await generateAgainstSpace(input, cfg);
    if (primary.ok) return primary;
    console.warn("[ZOZ_HF_ZERO_GPU] primary failed", JSON.stringify({ reason: primary.reason, event: primary.event || null, detail: primary.detail || null, httpStatus: primary.httpStatus || null }));

    // Free fallback: the original Qwen-Image Space runs on ZeroGPU large (1× quota),
    // while Qwen-Image-2512 uses xlarge (2× quota). Try it before declaring the
    // free path unavailable, without changing ZOZ's financial approval rules.
    const primaryIs2512 = cfg.profile === "qwen-image-2512" || /Qwen-Image-2512/i.test(cfg.model);
    const shouldTryLegacy = primaryIs2512 || cfg.profile !== "qwen-image";
    if (shouldTryLegacy) {
      const fallback = await generateAgainstSpace(input, {
        spaceUrl: "https://qwen-qwen-image.hf.space",
        apiName: "infer",
        profile: "qwen-image",
        model: "Qwen/Qwen-Image"
      });
      console.log("[ZOZ_HF_ZERO_GPU] legacy fallback result", JSON.stringify({ ok: fallback.ok, reason: fallback.reason || null, event: fallback.event || null, detail: fallback.detail || null, httpStatus: fallback.httpStatus || null }));
      if (fallback.ok) return { ...fallback, fallbackFrom: "qwen-image-2512" };
      return {
        ok: false,
        status: "failed",
        reason: "all_free_renderers_failed",
        primary: {
          reason: primary.reason,
          event: primary.event || null,
          detail: primary.detail || null,
          httpStatus: primary.httpStatus || null,
          spaceUrl: primary.spaceUrl || cfg.spaceUrl
        },
        fallback: {
          reason: fallback.reason,
          event: fallback.event || null,
          detail: fallback.detail || null,
          httpStatus: fallback.httpStatus || null,
          spaceUrl: fallback.spaceUrl
        }
      };
    }

    return primary;
  } catch (error) {
    if (error?.name === "AbortError" || /timeout/i.test(String(error?.message || ""))) {
      return { ok: false, status: "failed", reason: "zerogpu_timeout", detail: error.message };
    }
    return { ok: false, status: "unavailable", reason: "zerogpu_unreachable", detail: error.message };
  }
}

module.exports = { config, generateViaZeroGPU, buildData, findImageValue };
