const instagram = require("../integrations/upload-post-instagram");

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.ZOZ_INTERNAL_API_KEY;
  if (!secret) return false;
  return String(req.get("authorization") || "") === `Bearer ${secret}`;
}

function sendError(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

module.exports = async function handler(req, res) {
  if (!authorized(req)) return sendError(res, 401, "unauthorized");

  try {
    if (req.method === "GET") {
      const action = String(req.query?.action || "status");
      if (action === "status") {
        const result = await instagram.getInstagramStatus();
        return res.status(200).json({ ok: true, action, ...result });
      }
      if (action === "media") {
        const limit = Number(req.query?.limit || 10);
        const result = await instagram.getRecentMedia({ limit });
        return res.status(200).json({ ok: true, action, ...result });
      }
      return sendError(res, 400, "unsupported_action");
    }

    if (req.method === "POST") {
      const { action, mediaUrl, title, description } = req.body || {};
      if (action !== "publish") return sendError(res, 400, "unsupported_action");
      if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) return sendError(res, 400, "mediaUrl_must_be_public_http_url");
      const result = await instagram.publishVideo({ mediaUrl, title, description });
      return res.status(200).json({ ok: true, action, result });
    }

    res.setHeader("Allow", "GET, POST");
    return sendError(res, 405, "method_not_allowed");
  } catch (error) {
    console.error("Instagram integration error:", error.message);
    return sendError(res, Number(error.status) || 502, error.message || "instagram_integration_failed");
  }
};
