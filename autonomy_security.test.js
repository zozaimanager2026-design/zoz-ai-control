const assert = require("assert");
const http = require("http");

process.env.VERCEL = "1";
process.env.CRON_SECRET = "test-cron-secret";
process.env.PORT = "0";

const app = require("./server");

function request(path, authorization) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const req = http.request({
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: authorization ? { Authorization: authorization } : {}
      }, (res) => {
        res.resume();
        res.on("end", () => server.close(() => resolve(res.statusCode)));
      });
      req.on("error", (error) => server.close(() => reject(error)));
      req.end();
    });
  });
}

(async () => {
  assert.strictEqual(await request("/api/automation/cycle"), 401);
  assert.strictEqual(await request("/api/automation/cycle", "Bearer wrong-secret"), 401);

  const savedSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  assert.strictEqual(await request("/api/automation/cycle"), 503);
  process.env.CRON_SECRET = savedSecret;

  console.log("Autonomous cycle security tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
