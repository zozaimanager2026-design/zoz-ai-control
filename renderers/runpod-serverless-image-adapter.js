// ZOZ RunPod Serverless image adapter.
// Explicit provider adapter: ZOZ owns the model/container and RunPod only supplies
// on-demand GPU execution. No provider is selected unless RUNPOD_IMAGE_ENDPOINT_ID
// and RUNPOD_API_KEY are configured.
const API_BASE = String(process.env.RUNPOD_API_BASE || "https://api.runpod.ai/v2").replace(/\/$/, "");
const ENDPOINT_ID = String(process.env.RUNPOD_IMAGE_ENDPOINT_ID || "").trim();
const API_KEY = String(process.env.RUNPOD_API_KEY || "").trim();

function configured() {
  return Boolean(ENDPOINT_ID && API_KEY);
}

async function generate(input = {}) {
  if (!configured()) {
    return { ok: false, status: "unavailable", reason: "runpod_serverless_not_configured" };
  }

  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return { ok: false, status: "blocked", reason: "image_prompt_required" };

  const payload = {
    input: {
      prompt,
      negative_prompt: input.negativePrompt || "",
      width: input.width || 1024,
      height: input.height || 1024,
      steps: input.steps || 28,
      guidance_scale: input.guidanceScale ?? 4,
      seed: input.seed ?? -1,
      output_format: input.outputFormat || "png"
    }
  };

  const response = await fetch(API_BASE + "/" + encodeURIComponent(ENDPOINT_ID) + "/runsync", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { text: text.slice(0, 1000) }; }

  if (!response.ok) {
    return { ok: false, status: "failed", reason: "runpod_request_failed", httpStatus: response.status, detail: body.error || body.message || body };
  }

  if (body.status && body.status !== "COMPLETED") {
    return { ok: false, status: "failed", reason: "runpod_generation_" + String(body.status).toLowerCase(), requestId: body.id || null, detail: body.error || null };
  }

  const output = body.output || {};
  const imageUrl = output.image_url || output.image || output.url || (Array.isArray(output.images) ? output.images[0] : null);

  return {
    ok: Boolean(imageUrl),
    status: imageUrl ? "completed" : "failed",
    executionMode: "zoz-native-model-on-demand",
    renderer: "zoz-runpod-serverless",
    provider: "runpod",
    requestId: body.id || null,
    workerId: body.workerId || null,
    imageUrl,
    costUsd: typeof output.cost === "number" ? output.cost : null,
    rawOutput: imageUrl ? undefined : output
  };
}

module.exports = { configured, generate };
