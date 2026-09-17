// ZOZ native image adapter.
// The only network target here is the ZOZ-owned native image renderer service.
const NATIVE_URL = String(process.env.ZOZ_NATIVE_IMAGE_RENDERER_URL || "http://127.0.0.1:8100").replace(/\/$/, "");
const SECRET = process.env.ZOZ_NATIVE_IMAGE_RENDERER_SECRET || process.env.RENDERER_INTERNAL_SECRET || "";

async function renderImage(input = {}) {
  const prompt = String(input.prompt || input.description || input.title || "").trim();
  if (!prompt) return { ok: false, status: "blocked", reason: "image_prompt_required" };
  const response = await fetch(`${NATIVE_URL}/v1/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}) },
    body: JSON.stringify({
      prompt,
      negative_prompt: input.negativePrompt || "",
      width: input.width || 1024,
      height: input.height || 1024,
      steps: input.steps || 28,
      guidance_scale: input.guidanceScale ?? 4,
      seed: input.seed
    })
  });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { text: text.slice(0, 500) }; }
  if (!response.ok) return { ok: false, status: "failed", reason: body.detail || body.error || "native_image_renderer_failed", httpStatus: response.status };
  return { ok: true, executionMode: "zoz-native-image-renderer", renderer: body.service, model: body.model, device: body.device, seed: body.seed, path: body.path, filename: body.filename, width: body.width, height: body.height, elapsedSeconds: body.elapsed_seconds };
}

module.exports = { renderImage, NATIVE_URL };
