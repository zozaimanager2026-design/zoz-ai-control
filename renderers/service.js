// Standalone ZOZ Renderer Service
// This service is deliberately independent from the main dashboard runtime.
// It can run on Render, another Node host, or locally.
const http = require("http");
const runtime = require("./runtime");

const PORT = Number(process.env.RENDERER_PORT || process.env.PORT || 10000);
const HOST = process.env.RENDERER_HOST || "0.0.0.0";
const INTERNAL_SECRET = process.env.RENDERER_INTERNAL_SECRET || "";
function json(res, status, body) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); }
function authorized(req) { if (!INTERNAL_SECRET) return true; return req.headers.authorization === `Bearer ${INTERNAL_SECRET}`; }
function body(req) { return new Promise((resolve, reject) => { let data = ""; req.on("data", chunk => { data += chunk; if (data.length > 1024 * 1024) reject(new Error("payload_too_large")); }); req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid_json")); } }); req.on("error", reject); }); }
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, service: "zoz-independent-renderer", status: "ready" });
    if (req.method === "GET" && req.url === "/status") return json(res, 200, runtime.status());
    if (!authorized(req)) return json(res, 401, { ok: false, error: "unauthorized" });
    if (req.method === "POST" && req.url === "/inspect") return json(res, 200, runtime.inspectLibrary());
    if (req.method === "POST" && req.url === "/queue") { const task = await body(req); const result = runtime.queue(task); return json(res, result.ok === false ? 400 : 202, result); }
    if (req.method === "POST" && req.url === "/execute") { const input = await body(req); const result = input.jobId ? await runtime.executeQueued(input.jobId) : await runtime.execute(input.job || input); return json(res, result.ok === false ? (result.status === "approval_required" ? 403 : 400) : 200, result); }
    if (req.method === "POST" && req.url === "/improve") { const improvement = await body(req); return json(res, 201, runtime.recordImprovement(improvement)); }
    return json(res, 404, { ok: false, error: "not_found" });
  } catch (error) { return json(res, 500, { ok: false, error: error.message || "renderer_runtime_error" }); }
});
server.listen(PORT, HOST, () => process.stdout.write(`ZOZ independent renderer listening on ${HOST}:${PORT}\n`));
