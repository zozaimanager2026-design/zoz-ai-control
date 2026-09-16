const crypto = require("crypto");

// Runtime-only guard: VERCEL_TOKEN is read from the server environment and is never returned.
// The route only reports whether the secret exists and is protected by CRON_SECRET.
const expressPath = require.resolve("express");
const originalExpress = require(expressPath);

if (!originalExpress.__zozVercelTokenRoutePatched) {
  const wrappedExpress = function zozExpressWrapper(...args) {
    const app = originalExpress(...args);
    if (!app.__zozVercelTokenRouteAdded) {
      app.get("/api/vercel/status", (req, res) => {
        const secret = process.env.CRON_SECRET || "";
        const expected = `Bearer ${secret}`;
        const actual = String(req.get("authorization") || "");
        if (!secret) return res.status(503).json({ ok: false, error: "endpoint_secret_not_configured" });
        const a = Buffer.from(actual);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return res.status(401).json({ ok: false, error: "vercel_status_unauthorized" });
        }

        const configured = Boolean(process.env.VERCEL_TOKEN);
        return res.json({
          ok: true,
          provider: "vercel",
          configured,
          tokenExposed: false,
          tokenStoredInEnvironment: configured,
          financialApprovalRequired: true
        });
      });
      app.__zozVercelTokenRouteAdded = true;
    }
    return app;
  };

  Object.setPrototypeOf(wrappedExpress, Object.getPrototypeOf(originalExpress));
  for (const key of Object.getOwnPropertyNames(originalExpress)) {
    if (!["length", "name", "prototype"].includes(key)) {
      try { Object.defineProperty(wrappedExpress, key, Object.getOwnPropertyDescriptor(originalExpress, key)); } catch {}
    }
  }
  wrappedExpress.__zozVercelTokenRoutePatched = true;
  require.cache[expressPath].exports = wrappedExpress;
}
