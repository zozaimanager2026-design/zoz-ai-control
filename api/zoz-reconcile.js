const { reconcileAutonomyState } = require("../autonomous-runtime");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || "";
  if (expected && authorization !== `Bearer ${expected}`) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (process.env.NODE_ENV === "production" && !expected) return res.status(503).json({ ok: false, error: "CRON_SECRET_missing" });
  try {
    return res.json(await reconcileAutonomyState());
  } catch (error) {
    console.error("ZOZ reconciliation failed:", error);
    return res.status(500).json({ ok: false, error: "reconciliation_failed" });
  }
};
