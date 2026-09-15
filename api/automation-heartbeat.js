const crypto = require("crypto");
const { runAutonomousRuntime } = require("../autonomous-runtime");

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const expected = `Bearer ${secret}`;
  const actual = String(req.headers.authorization || "");
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  if (!authorized(req)) return res.status(process.env.CRON_SECRET ? 401 : 503).json({ ok: false, error: "cron_not_authorized" });
  try {
    return res.status(200).json(await runAutonomousRuntime("scheduled_heartbeat"));
  } catch {
    return res.status(500).json({ ok: false, error: "autonomy_heartbeat_failed" });
  }
};
