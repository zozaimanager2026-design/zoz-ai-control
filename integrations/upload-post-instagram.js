const API_BASE = process.env.UPLOAD_POST_API_BASE || "https://api.upload-post.com";
const API_KEY = process.env.UPLOAD_POST_API_KEY || "";
const PROFILE = process.env.UPLOAD_POST_PROFILE || "ZozAI";
const PLATFORM = "instagram";

function requireKey() {
  if (!API_KEY) throw new Error("UPLOAD_POST_API_KEY is not configured");
}

async function request(path, options = {}) {
  requireKey();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Apikey ${API_KEY}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { text: text.slice(0, 500) }; }
  if (!response.ok) {
    const error = new Error(body?.message || `Upload-Post request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function getProfiles() {
  return request("/api/uploadposts/users");
}

async function getInstagramStatus(profile = PROFILE) {
  const data = await getProfiles();
  const item = (data.profiles || []).find((p) => p.username === profile);
  if (!item) return { connected: false, profile, reason: "profile_not_found" };
  const instagram = item.social_accounts?.instagram;
  return {
    connected: Boolean(instagram && typeof instagram === "object" && !item.social_accounts?.instagram?.reauth_required),
    reauthRequired: Boolean(instagram?.reauth_required),
    profile,
    handle: instagram?.handle || null,
    displayName: instagram?.display_name || null,
    accountId: instagram?.username || null
  };
}

async function getRecentMedia({ profile = PROFILE, limit = 10 } = {}) {
  return request(`/api/uploadposts/media?platform=${encodeURIComponent(PLATFORM)}&user=${encodeURIComponent(profile)}&limit=${Math.min(Math.max(limit, 1), 100)}`);
}

module.exports = {
  PROFILE,
  PLATFORM,
  getProfiles,
  getInstagramStatus,
  getRecentMedia
};
