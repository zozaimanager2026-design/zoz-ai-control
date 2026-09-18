// ZOZ Asset Store — durable binary storage in PostgreSQL.
// Metadata stays in ZOZ state; successful remote image bytes are copied into Postgres
// so the gallery does not depend on an expiring provider URL.
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || process.env.ZOZ_DATABASE_URL || "";
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 }) : null;
const MAX_BYTES = 25 * 1024 * 1024;

function safeText(value, max = 4000) {
  return String(value || "").slice(0, max);
}

function allowedRemoteHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host.endsWith(".hf.space") ||
    host === "hf.space" ||
    host.endsWith(".huggingface.co") ||
    host === "huggingface.co" ||
    host.endsWith(".huggingfaceusercontent.com") ||
    host === "huggingfaceusercontent.com" ||
    host.endsWith(".runpod.net") ||
    host.endsWith(".runpod.io");
}

async function ensureTable() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zoz_assets (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT,
      prompt TEXT,
      provider TEXT,
      source_url TEXT,
      bytes BYTEA NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  return true;
}

async function fetchImage(url) {
  let parsed;
  try { parsed = new URL(String(url)); } catch { throw new Error("invalid_asset_url"); }
  if (parsed.protocol !== "https:" || !allowedRemoteHost(parsed.hostname)) throw new Error("asset_source_not_allowed");
  const response = await fetch(parsed.toString(), { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`asset_source_http_${response.status}`);
  const mime = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!mime.startsWith("image/")) throw new Error("asset_source_not_image");
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("asset_too_large");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("asset_too_large");
  return { buffer, mime };
}

async function persistImage({ id, imageUrl, prompt, provider } = {}) {
  if (!pool || !imageUrl) return { ok: false, status: "not_persisted", reason: !pool ? "postgres_not_configured" : "image_url_missing" };
  await ensureTable();
  const { buffer, mime } = await fetchImage(imageUrl);
  const assetId = String(id || `asset_${Date.now()}`);
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "png";
  await pool.query(
    `INSERT INTO zoz_assets (id, kind, mime_type, filename, prompt, provider, source_url, bytes, size_bytes)
     VALUES ($1, 'image', $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET bytes=EXCLUDED.bytes, mime_type=EXCLUDED.mime_type, size_bytes=EXCLUDED.size_bytes, source_url=EXCLUDED.source_url`,
    [assetId, mime, `${assetId}.${ext}`, safeText(prompt), safeText(provider, 200), safeText(imageUrl, 4000), buffer, buffer.length]
  );
  return { ok: true, id: assetId, mimeType: mime, sizeBytes: buffer.length, url: `/api/assets/${encodeURIComponent(assetId)}` };
}

async function getImage(id) {
  if (!pool) return null;
  await ensureTable();
  const result = await pool.query("SELECT id, mime_type, filename, bytes FROM zoz_assets WHERE id = $1 AND kind = 'image'", [String(id)]);
  return result.rows[0] || null;
}

function status() {
  return { enabled: Boolean(pool), provider: pool ? "postgresql-bytea" : "disabled", maxBytes: MAX_BYTES };
}

module.exports = { persistImage, getImage, status, ensureTable };