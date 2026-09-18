const ORIGIN = "https://zoz-ai-control-production.up.railway.app";

function corsHeaders(origin = "") {
  const allowed = origin === "https://zoz-ai-control.vercel.app" || origin === "https://zoz-ai-control-production.up.railway.app" || origin === "" || origin === "null";
  return {
    "Access-Control-Allow-Origin": allowed && origin && origin !== "null" ? origin : "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

    if (url.pathname === "/api/ai/image") {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

      try {
        const body = await request.json();
        const prompt = String(body?.prompt || body?.description || body?.title || "").trim();
        if (!prompt) return json({ ok: false, error: "image_prompt_required" }, 400, origin);
        if (prompt.length > 2048) return json({ ok: false, error: "image_prompt_too_long" }, 400, origin);

        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
          prompt,
          steps: Math.min(8, Math.max(1, Number(body?.steps || body?.num_inference_steps || 4))),
          seed: Number.isFinite(Number(body?.seed)) ? Number(body.seed) : Math.floor(Math.random() * 2147483647)
        });

        if (!result?.image) return json({ ok: false, error: "cloudflare_ai_empty_image" }, 502, origin);

        return json({
          ok: true,
          provider: "cloudflare-workers-ai",
          model: "@cf/black-forest-labs/flux-1-schnell",
          imageBase64: result.image,
          mimeType: "image/jpeg",
          executionMode: "cloudflare-free-quota"
        }, 200, origin);
      } catch (error) {
        return json({
          ok: false,
          provider: "cloudflare-workers-ai",
          error: "cloudflare_ai_generation_failed",
          detail: String(error?.message || error).slice(0, 500)
        }, 502, origin);
      }
    }

    if (url.pathname === "/api/ai/status") {
      return json({
        ok: true,
        provider: "cloudflare-workers-ai",
        model: "@cf/black-forest-labs/flux-1-schnell",
        binding: Boolean(env.AI),
        mode: "free-quota-first"
      }, 200, origin);
    }

    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    const upstream = await fetch(new Request(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "follow"
    }));

    const responseHeaders = new Headers(upstream.headers);
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => responseHeaders.set(key, value));
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  }
};
