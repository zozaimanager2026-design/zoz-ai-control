// ZOZ adapter for a Hugging Face Gradio ZeroGPU Space.
// It intentionally uses the public Gradio API surface rather than binding Core to Hugging Face internals.

const https = require("https");

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        let parsedBody = {};
        try { parsedBody = data ? JSON.parse(data) : {}; } catch { parsedBody = { text: data }; }
        resolve({ status: res.statusCode || 500, body: parsedBody });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function generateViaZeroGPU(input = {}) {
  const spaceUrl = String(process.env.ZOZ_HF_SPACE_URL || "").replace(/\/$/, "");
  if (!spaceUrl) return { ok: false, status: "blocked", reason: "ZOZ_HF_SPACE_URL_missing" };

  const payload = {
    data: [
      String(input.prompt || input.description || input.title || ""),
      String(input.negativePrompt || ""),
      Number(input.width || 1024),
      Number(input.height || 1024),
      Number(input.steps || 28),
      Number(input.guidanceScale ?? 4),
      input.seed == null ? -1 : Number(input.seed),
      process.env.ZOZ_HF_SPACE_SECRET || "",
    ],
  };

  const headers = {};
  if (process.env.HF_TOKEN) headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;

  const start = await requestJson(`${spaceUrl}/gradio_api/call/generate`, {
    method: "POST",
    headers,
  }, payload);

  if (start.status < 200 || start.status >= 300 || !start.body.event_id) {
    return { ok: false, status: "failed", reason: "zerogpu_enqueue_failed", httpStatus: start.status };
  }

  const eventId = start.body.event_id;
  const deadline = Date.now() + Number(process.env.ZOZ_HF_TIMEOUT_MS || 180000);

  while (Date.now() < deadline) {
    const result = await new Promise((resolve, reject) => {
      const parsed = new URL(`${spaceUrl}/gradio_api/call/generate/${encodeURIComponent(eventId)}`);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: "GET",
        headers: { Accept: "text/event-stream", ...(headers.Authorization ? { Authorization: headers.Authorization } : {}) },
      }, (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => resolve({ status: res.statusCode || 500, data }));
      });
      req.on("error", reject);
      req.end();
    });

    const lines = String(result.data || "").split("\n");
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let event;
      try { event = JSON.parse(raw); } catch { continue; }
      if (Array.isArray(event) && event.length >= 2 && event[0]?.path) {
        const metadata = event[1] || {};
        return {
          ok: true,
          executionMode: "huggingface-zerogpu",
          renderer: "zoz-native-image-renderer",
          model: metadata.model || process.env.ZOZ_IMAGE_MODEL || "Qwen/Qwen-Image-2512",
          device: metadata.device || "cuda",
          seed: metadata.seed,
          path: event[0].path,
          filename: metadata.filename,
          width: metadata.width,
          height: metadata.height,
          elapsedSeconds: metadata.elapsed_seconds,
        };
      }
      if (event === "error") return { ok: false, status: "failed", reason: "zerogpu_generation_error" };
    }

    await sleep(1000);
  }

  return { ok: false, status: "failed", reason: "zerogpu_timeout" };
}

module.exports = { generateViaZeroGPU };
