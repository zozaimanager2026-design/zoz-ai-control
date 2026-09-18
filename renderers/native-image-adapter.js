// ZOZ Native Image Adapter — provider-independent control layer.
// Priority: ZOZ-owned renderer -> explicitly enabled free adapter -> clear blocked state.
// A paid external image API is never selected implicitly.
const NATIVE_URL = String(process.env.ZOZ_NATIVE_IMAGE_RENDERER_URL || "http://127.0.0.1:8100").replace(/\/$/, "");
const SECRET = process.env.ZOZ_NATIVE_IMAGE_RENDERER_SECRET || process.env.RENDERER_INTERNAL_SECRET || "";
const { generateViaZeroGPU } = require("./huggingface-zerogpu");
const runpod = require("./runpod-serverless-image-adapter");

async function requestNative(payload) {
  try {
    const response = await fetch(NATIVE_URL + "/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(SECRET ? { Authorization: "Bearer " + SECRET } : {}) },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { text: text.slice(0, 500) }; }
    if (!response.ok) return { ok: false, status: "failed", reason: body.detail || body.error || "native_image_renderer_failed", httpStatus: response.status };
    return { ok: true, executionMode: "zoz-native-image-renderer", renderer: body.service || "zoz-native-image-renderer", model: body.model, device: body.device, seed: body.seed, path: body.path, filename: body.filename, width: body.width, height: body.height, elapsedSeconds: body.elapsed_seconds };
  } catch (error) { return { ok: false, status: "unavailable", reason: "native_renderer_unreachable", detail: error.message }; }
}

async function renderImage(input = {}) {
  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return { ok: false, status: "blocked", reason: "image_prompt_required" };
  const payload = { prompt, negative_prompt: input.negativePrompt || "", width: input.width || 1024, height: input.height || 1024, steps: input.steps || 28, guidance_scale: input.guidanceScale ?? 4, seed: input.seed };
  const native = await requestNative(payload);
  if (native.ok) return native;
  if (String(process.env.ZOZ_IMAGE_PROVIDER || "").toLowerCase() === "runpod-serverless" && runpod.configured()) {
    const remote = await runpod.generate(input);
    if (remote.ok) return remote;
    return { ok: false, status: "failed", reason: "runpod_native_render_failed", detail: remote.reason, provider: "runpod" };
  }
  if (String(process.env.ZOZ_ALLOW_FREE_FALLBACK || "").toLowerCase() === "true" && process.env.ZOZ_HF_SPACE_URL) {
    const free = await generateViaZeroGPU(input);
    if (free.ok) return free;
    return { ok: false, status: "failed", reason: "all_free_renderers_failed", nativeReason: native.reason, fallbackReason: free.reason };
  }
  return { ok: false, status: "waiting_for_renderer", reason: "zoz_native_renderer_not_available", next: "Attach a ZOZ-owned GPU renderer at ZOZ_NATIVE_IMAGE_RENDERER_URL. Paid providers remain optional fallbacks and are not required by the engine." };
}

module.exports = { renderImage, NATIVE_URL };