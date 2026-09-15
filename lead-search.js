const OVERPASS_URL = process.env.ZOZ_OVERPASS_URL || "https://overpass-api.de/api/interpreter";

const now = () => new Date().toISOString();

async function overpassSearch({ query = "محلات أدوات كهربائية مقاول كهرباء تشطيبات القاهرة", limit = 10 } = {}) {
  // Cairo-area default bbox. OSM is a keyless fallback so ZOZ does not stop
  // when a paid search API credential is unavailable.
  const bbox = process.env.ZOZ_LEAD_BBOX || "29.80,31.05,30.25,31.70";
  const osmQuery = `
[out:json][timeout:25];
(
  nwr[shop=electronics](${bbox});
  nwr[shop=electrical](${bbox});
  nwr[shop=hardware](${bbox});
  nwr[craft=electrician](${bbox});
  nwr[office=company]["craft"="electrical"](${bbox});
);
out center tags;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams({ data: osmQuery }),
      signal: controller.signal
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, source: "overpass", status: r.status, reason: "overpass_request_failed" };
    let data;
    try { data = JSON.parse(text); } catch { return { ok: false, source: "overpass", reason: "overpass_invalid_json" }; }

    const seen = new Set();
    const results = [];
    for (const element of data.elements || []) {
      const tags = element.tags || {};
      const name = tags.name || tags["name:ar"] || tags["name:en"];
      if (!name) continue;
      const key = `${name}|${tags.phone || tags["contact:phone"] || tags.website || ""}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const lat = element.lat ?? element.center?.lat ?? null;
      const lon = element.lon ?? element.center?.lon ?? null;
      results.push({
        name,
        title: name,
        source: "openstreetmap",
        category: tags.shop || tags.craft || tags.office || "business",
        phone: tags.phone || tags["contact:phone"] || null,
        email: tags.email || tags["contact:email"] || null,
        website: tags.website || tags["contact:website"] || null,
        address: tags["addr:full"] || [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" ") || null,
        latitude: lat,
        longitude: lon,
        query,
        discoveredAt: now()
      });
      if (results.length >= Math.max(1, Math.min(100, Number(limit) || 10))) break;
    }
    return { ok: true, source: "openstreetmap", results };
  } finally {
    clearTimeout(timer);
  }
}

async function searchLeads(options = {}) {
  const endpoint = process.env.ZOZ_SEARCH_API_URL;
  const key = process.env.ZOZ_SEARCH_API_KEY;
  if (endpoint && key) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: options.query, limit: options.limit || 10 }),
        signal: controller.signal
      });
      const text = await r.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
      if (r.ok && Array.isArray(body?.results)) return { ok: true, source: "configured_search_api", results: body.results };
    } finally {
      clearTimeout(timer);
    }
  }
  return overpassSearch(options);
}

module.exports = { searchLeads, overpassSearch };
