// ZOZ Native Image Adapter — provider-independent control layer.
// Free/open-source execution is always preferred. Paid execution is explicit and approval-gated.
const NATIVE_URL = String(process.env.ZOZ_NATIVE_IMAGE_RENDERER_URL || "http://127.0.0.1:8100").replace(/\/$/, "");
const SECRET = process.env.ZOZ_NATIVE_IMAGE_RENDERER_SECRET || process.env.RENDERER_INTERNAL_SECRET || "";
const { generateViaZeroGPU, config: hfConfig } = require("./huggingface-zerogpu");
const runpod = require("./runpod-serverless-image-adapter");
const CLOUDFLARE_AI_URL = String(process.env.ZOZ_CLOUDFLARE_AI_URL || "").replace(/\/$/, "");

console.log("[ZOZ_NATIVE_IMAGE_ADAPTER_V2] loaded from current main");
const provider = () => String(process.env.ZOZ_IMAGE_PROVIDER || "native").trim().toLowerCase();
const paidProvider = selected => selected === "runpod-serverless";

async function requestNative(payload) {
  try {
    const response = await fetch(NATIVE_URL + "/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(SECRET ? { Authorization: "Bearer " + SECRET } : {}) },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { text: text.slice(0, 500) }; }
    if (!response.ok) return { ok: false, status: "failed", reason: body.detail || body.error || "native_image_renderer_failed", httpStatus: response.status };
    return {
      ok: true,
      executionMode: "zoz-native-image-renderer",
      renderer: body.service || "zoz-native-image-renderer",
      provider: "zoz-native",
      model: body.model,
      device: body.device,
      seed: body.seed,
      path: body.path,
      filename: body.filename,
      width: body.width,
      height: body.height,
      elapsedSeconds: body.elapsed_seconds
    };
  } catch (error) {
    return { ok: false, status: "unavailable", reason: "native_renderer_unreachable", detail: error.message };
  }
}

function payloadForNative(input) {
  return {
    prompt: String(input.prompt || input.description || input.title || "").trim(),
    negative_prompt: input.negativePrompt || input.negative_prompt || "",
    width: input.width || 1024,
    height: input.height || 1024,
    steps: input.steps || input.num_inference_steps || 28,
    guidance_scale: input.guidanceScale ?? input.guidance_scale ?? 4,
    seed: input.seed
  };
}

async function requestCloudflare(input) {
  if (!CLOUDFLARE_AI_URL) return { ok: false, status: "unavailable", reason: "cloudflare_ai_url_not_configured" };
  try {
    const response = await fetch(CLOUDFLARE_AI_URL + "/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: input.prompt || input.description || input.title || "",
        steps: input.steps || input.num_inference_steps || 4,
        seed: input.seed
      })
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { text: text.slice(0, 500) }; }
    if (!response.ok || !body.imageBase64) return { ok: false, status: "failed", reason: body.error || "cloudflare_ai_generation_failed", detail: body.detail || null, httpStatus: response.status };
    return {
      ok: true,
      executionMode: "cloudflare-workers-ai",
      provider: "cloudflare-workers-ai",
      model: body.model,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType || "image/jpeg"
    };
  } catch (error) {
    return { ok: false, status: "unavailable", reason: "cloudflare_ai_unreachable", detail: error.message };
  }
}

async function renderImage(input = {}) {
  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return { ok: false, status: "blocked", reason: "image_prompt_required" };

  const selected = provider();
  const paidApproved = input.paidExecutionApproved === true || input.humanApproval === true;

  if ((selected === "huggingface-zerogpu" || selected === "huggingface") && hfConfig().enabled) {
    const free = await generateViaZeroGPU(input);
    if (free.ok) return free;
    if (selected !== "huggingface") return free;
    const native = await requestNative(payloadForNative(input));
    if (native.ok) return native;
    return { ok: false, status: "failed", reason: "free_renderer_failed", freeReason: free.reason, nativeReason: native.reason };
  }

  // ZOZ-native renderer is attempted first; Cloudflare Workers AI is the free cloud fallback.
  const native = await requestNative(payloadForNative(input));
  if (native.ok) return native;
  const cloudflare = await requestCloudflare(input);
  if (cloudflare.ok) return cloudflare;

  if (selected === "runpod-serverless") {
    if (!paidApproved) {
      return {
        ok: false,
        status: "approval_required",
        reason: "paid_renderer_requires_human_approval",
        provider: "runpod",
        freeRendererReason: native.reason,
        cloudflareReason: cloudflare.reason,
        policy: "free_first_then_pay_per_heavy_job"
      };
    }
    if (runpod.configured()) {
      const remote = await runpod.generate(input);
      if (remote.ok) return remote;
      return { ok: false, status: "failed", reason: "runpod_native_render_failed", detail: remote.reason, provider: "runpod" };
    }
    return { ok: false, status: "blocked", reason: "paid_renderer_not_configured", provider: "runpod" };
  }

  if (String(process.env.ZOZ_ALLOW_FREE_FALLBACK || "").toLowerCase() === "true" && hfConfig().enabled) {
    const free = await generateViaZeroGPU(input);
    if (free.ok) return free;
    return { ok: false, status: "failed", reason: "all_free_renderers_failed", nativeReason: native.reason, fallbackReason: free.reason };
  }

  return {
    ok: false,
    status: "waiting_for_renderer",
    reason: "zoz_native_renderer_not_available",
    next: "Attach a ZOZ-owned GPU renderer or enable the free Hugging Face ZeroGPU adapter."
  };
}

function status() {
  const selected = provider();
  return {
    selectedProvider: selected,
    executionPolicy: "free_first_then_pay_per_heavy_job",
    paidExecutionRequiresHumanApproval: paidProvider(selected),
    huggingface: hfConfig(),
    runpodConfigured: runpod.configured(),
    cloudflareConfigured: Boolean(CLOUDFLARE_AI_URL),
    cloudflareAiUrl: CLOUDFLARE_AI_URL || null,
    nativeUrl: NATIVE_URL
  };
}

module.exports = { renderImage, NATIVE_URL, provider, status };
// Railway source-refresh marker: force production sync to current main after renderer validation (2026-09-19).