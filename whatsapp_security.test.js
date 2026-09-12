const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.VERCEL = "1";
process.env.WHATSAPP_SEND_SECRET = crypto.randomBytes(24).toString("hex");
process.env.CRON_SECRET = crypto.randomBytes(24).toString("hex");
const app = require("./server");
const http = require("node:http");

const server = http.createServer(app);

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: options.method || "GET", headers: options.headers || {} }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const cron = await request("/api/automation/cycle");
    assert.equal(cron.status, 401);

    const payload = JSON.stringify({ to: "+201001234567", text: "رسالة عادية" });
    const unauthorized = await request("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }, body: payload });
    assert.equal(unauthorized.status, 401);

    const financialPayload = JSON.stringify({ to: "+201001234567", text: "ادفع 100 جنيه" });
    const financial = await request("/api/whatsapp/send", { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_SEND_SECRET}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(financialPayload) }, body: financialPayload });
    assert.equal(financial.status, 403);

    const normal = await request("/api/whatsapp/send", { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_SEND_SECRET}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }, body: payload });
    assert.equal(normal.status, 503);

    console.log("WhatsApp endpoint security and financial gate: healthy");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
