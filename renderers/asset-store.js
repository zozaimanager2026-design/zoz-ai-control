// ZOZ Asset Store — durable image persistence for the application.
// Primary: PostgreSQL BYTEA (durable across deploys/restarts).
// Backup: local filesystem mirror (best-effort; ephemeral when the host has no volume).
// Source URL: retained as recovery metadata only.
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
function mimeFromDataUri(value) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(String(value || ""));
  return match ? match[1].toLowerCase() : null;
}
function bufferFromBase64(value) {
  const raw = String(value || "");
  const mime = mimeFromDataUri(raw) || "image/png";
  const payload = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length) throw new Error("asset_base64_empty");
  if (buffer.length > MAX_BYTES) throw new Error("asset_too_large");
  return { buffer, mime };
}
async function fetchImage(url, sourceBaseUrl = "") {
  let parsed;
  try {
    const raw = String(url || "");
    parsed = new URL(raw, sourceBaseUrl || undefined);
  } catch { throw new Error("invalid_asset_url"); }
  if (parsed.protocol !== "https:" || !allowedRemoteHost(parsed.hostname)) throw new Error("asset_source_not_allowed");
  const response = await fetch(parsed.toString(), { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`asset_source_http_${response.status}`);
  const mime = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!mime.startsWith("image/")) throw new Error("asset_source_not_image");
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("asset_too_large");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("asset_too_large");
  return { buffer, mime, sourceUrl: parsed.toString() };
}
function extFor(mime) { return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "png"; }
async function ensureTable() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zoz_assets (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, mime_type TEXT NOT NULL, filename TEXT,
      prompt TEXT, provider TEXT, source_url TEXT, bytes BYTEA NOT NULL,
      size_bytes INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_zoz_assets_kind_created_at ON zoz_assets(kind, created_at DESC)");
  return true;
}
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
async function persistImage({ id, imageUrl, imageBase64, sourceBaseUrl, prompt, provider } = {}) {
  if (!imageUrl && !imageBase64) return { ok: false, status: "not_persisted", reason: "image_source_missing" };
  const assetId = String(id || `asset_${Date.now()}`);
  let sourceUrl = imageUrl || "";
  let buffer;
  let mime;
  if (imageBase64) {
    ({ buffer, mime } = bufferFromBase64(imageBase64));
  } else {
    const fetched = await fetchImage(imageUrl, sourceBaseUrl);
    buffer = fetched.buffer; mime = fetched.mime; sourceUrl = fetched.sourceUrl;
  }
  const ext = extFor(mime);
  const results = { primary: false, backup: false, source: Boolean(imageUrl || imageBase64), tiers: [] };
  try {
    if (pool) {
      await ensureTable();
      await pool.query(
        `INSERT INTO zoz_assets (id, kind, mime_type, filename, prompt, provider, source_url, bytes, size_bytes)
         VALUES ($1, 'image', $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET bytes=EXCLUDED.bytes, mime_type=EXCLUDED.mime_type,
         filename=EXCLUDED.filename, prompt=EXCLUDED.prompt, provider=EXCLUDED.provider,
         size_bytes=EXCLUDED.size_bytes, source_url=EXCLUDED.source_url`,
        [assetId, mime, `${assetId}.${ext}`, safeText(prompt), safeText(provider, 200), safeText(sourceUrl, 4000), buffer, buffer.length]
      );
      results.primary = true; results.tiers.push("postgresql");
    }
  } catch (error) { results.primaryError = error.message; }
  try {
    const backup = await writeBackup(assetId, buffer, mime, { prompt, provider, sourceUrl });
    results.backup = true; results.tiers.push("filesystem");
    return { ok: results.primary || results.backup, id: assetId, mimeType: mime, sizeBytes: buffer.length, url: backup.url, primary: results.primary, backup: results.backup, sourceUrl, failover: results };
  } catch (error) {
    results.backupError = error.message;
    return { ok: results.primary, id: assetId, mimeType: mime, sizeBytes: buffer.length, url: `/api/assets/${encodeURIComponent(assetId)}`, primary: results.primary, backup: false, sourceUrl, failover: results };
  }
}
async function listImages(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  if (!pool) return [];
  try {
    await ensureTable();
    const result = await pool.query(
      "SELECT id, mime_type, filename, prompt, provider, size_bytes, source_url, created_at FROM zoz_assets WHERE kind = 'image' ORDER BY created_at DESC LIMIT $1",
      [safeLimit]
    );
    return result.rows.map(row => ({
      id: row.id,
      imageUrl: `/api/assets/${encodeURIComponent(row.id)}`,
      filename: row.filename,
      mimeType: row.mime_type,
      prompt: row.prompt,
      provider: row.provider,
      sizeBytes: row.size_bytes,
      sourceUrl: row.source_url || null,
      createdAt: row.created_at
    }));
  } catch { return []; }
}
async function getImage(id) {
  const key = String(id);
  if (pool) {
    try {
      await ensureTable();
      const result = await pool.query("SELECT id, mime_type, filename, bytes, source_url FROM zoz_assets WHERE id = $1 AND kind = 'image'", [key]);
      if (result.rows[0]) return { ...result.rows[0], tier: "postgresql" };
    } catch {}
  }
  try {
    const backup = await readBackup(key);
    if (backup) return { ...backup, tier: "filesystem" };
  } catch {}
  return null;
}
function status() {
  return {
    enabled: Boolean(pool) || true,
    durablePrimary: Boolean(pool),
    provider: pool ? "postgresql-bytea+filesystem-backup" : "filesystem-backup-only",
    tiers: ["postgresql", "filesystem", "source_url"],
    backupDir: BACKUP_DIR,
    maxBytes: MAX_BYTES,
    failover: "automatic",
    browserPath: "/api/assets/:id",
    libraryPath: "/api/assets"
  };
}
module.exports = { persistImage, listImages, getImage, status, ensureTable };
