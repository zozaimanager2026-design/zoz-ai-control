// ZOZ Asset Store — redundant image persistence with automatic failover.
// Tier 1: PostgreSQL BYTEA (durable primary).
// Tier 2: local filesystem mirror (temporary emergency backup; configure ZOZ_ASSET_BACKUP_DIR).
// Tier 3: original HTTPS provider URL (last-resort recovery source).
// Reads automatically fall through Tier 1 -> Tier 2 -> Tier 3.
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL || process.env.ZOZ_DATABASE_URL || "";
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 }) : null;
const BACKUP_DIR = process.env.ZOZ_ASSET_BACKUP_DIR || path.join(process.cwd(), ".zoz-renderer", "asset-backup");
const MAX_BYTES = 25 * 1024 * 1024;

function safeText(value, max = 4000) { return String(value || "").slice(0, max); }
function allowedRemoteHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host.endsWith(".hf.space") || host === "hf.space" ||
    host.endsWith(".huggingface.co") || host === "huggingface.co" ||
    host.endsWith(".huggingfaceusercontent.com") || host === "huggingfaceusercontent.com" ||
    host.endsWith(".runpod.net") || host.endsWith(".runpod.io");
}
async function ensureTable() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zoz_assets (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, mime_type TEXT NOT NULL, filename TEXT,
      prompt TEXT, provider TEXT, source_url TEXT, bytes BYTEA NOT NULL,
      size_bytes INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
function extFor(mime) { return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "png"; }
async function writeBackup(assetId, buffer, mime, meta = {}) {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const ext = extFor(mime);
  const file = path.join(BACKUP_DIR, `${assetId}.${ext}`);
  const manifest = path.join(BACKUP_DIR, `${assetId}.json`);
  await fs.promises.writeFile(file, buffer);
  await fs.promises.writeFile(manifest, JSON.stringify({
    id: assetId, mime_type: mime, filename: `${assetId}.${ext}`,
    prompt: safeText(meta.prompt), provider: safeText(meta.provider, 200),
    source_url: safeText(meta.sourceUrl), created_at: new Date().toISOString()
  }));
  return { ok: true, path: file, url: `/api/assets/${encodeURIComponent(assetId)}`, tier: "filesystem_backup" };
}
async function readBackup(id) {
  const manifestPath = path.join(BACKUP_DIR, `${id}.json`);
  if (!fs.existsSync(manifestPath)) return null;
  const meta = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  const file = path.join(BACKUP_DIR, String(meta.filename || `${id}.png`));
  if (!fs.existsSync(file)) return null;
  return { id: String(id), mime_type: meta.mime_type || "image/png", filename: meta.filename || `${id}.png`, bytes: await fs.promises.readFile(file), source_url: meta.source_url || "" };
}
async function persistImage({ id, imageUrl, prompt, provider } = {}) {
  if (!imageUrl) return { ok: false, status: "not_persisted", reason: "image_url_missing" };
  const assetId = String(id || `asset_${Date.now()}`);
  const { buffer, mime } = await fetchImage(imageUrl);
  const ext = extFor(mime);
  const results = { primary: false, backup: false, source: true, tiers: [] };
  try {
    if (pool) {
      await ensureTable();
      await pool.query(
        `INSERT INTO zoz_assets (id, kind, mime_type, filename, prompt, provider, source_url, bytes, size_bytes)
         VALUES ($1, 'image', $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET bytes=EXCLUDED.bytes, mime_type=EXCLUDED.mime_type,
         size_bytes=EXCLUDED.size_bytes, source_url=EXCLUDED.source_url`,
        [assetId, mime, `${assetId}.${ext}`, safeText(prompt), safeText(provider, 200), safeText(imageUrl, 4000), buffer, buffer.length]
      );
      results.primary = true; results.tiers.push("postgresql");
    }
  } catch (error) { results.primaryError = error.message; }
  try {
    const backup = await writeBackup(assetId, buffer, mime, { prompt, provider, sourceUrl: imageUrl });
    results.backup = true; results.tiers.push("filesystem");
    return { ok: results.primary || results.backup, id: assetId, mimeType: mime, sizeBytes: buffer.length, url: backup.url, primary: results.primary, backup: results.backup, sourceUrl: imageUrl, failover: results };
  } catch (error) {
    results.backupError = error.message;
    return { ok: results.primary, id: assetId, mimeType: mime, sizeBytes: buffer.length, url: `/api/assets/${encodeURIComponent(assetId)}`, primary: results.primary, backup: false, sourceUrl: imageUrl, failover: results };
  }
}
async function getImage(id) {
  const key = String(id);
  if (pool) {
    try {
      await ensureTable();
      const result = await pool.query("SELECT id, mime_type, filename, bytes, source_url FROM zoz_assets WHERE id = $1 AND kind = 'image'", [key]);
      if (result.rows[0]) return { ...result.rows[0], tier: "postgresql" };
    } catch (error) { /* automatic failover below */ }
  }
  try {
    const backup = await readBackup(key);
    if (backup) return { ...backup, tier: "filesystem" };
  } catch (error) { /* automatic failover below */ }
  return null;
}
function status() {
  return {
    enabled: Boolean(pool) || true,
    provider: pool ? "postgresql+filesystem+source-failover" : "filesystem+source-failover",
    tiers: ["postgresql", "filesystem", "source_url"],
    backupDir: BACKUP_DIR,
    maxBytes: MAX_BYTES,
    failover: "automatic"
  };
}
module.exports = { persistImage, getImage, status, ensureTable };
