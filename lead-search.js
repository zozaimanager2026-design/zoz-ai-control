const DEFAULT_OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

const now = () => new Date().toISOString();

function overpassEndpoints() {
  const custom = process.env.ZOZ_OVERPASS_URL;
  return custom ? [custom, ...DEFAULT_OVERPASS_ENDPOINTS.filter((url) => url !== custom)] : DEFAULT_OVERPASS_ENDPOINTS;
}

async function overpassSearch({ query = "محلات أدوات كهربائية مقاول كهرباء تشطيبات القاهرة", limit = 10 } = {}) {
  // Cairo-area default bbox. OSM is a keyless fallback so ZOZ does not stop
  // when a paid search API credential is unavailable. Multiple mirrors prevent
  // one public Overpass endpoint outage from becoming a system blocker.
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

  const failures = [];
  for (const endpoint of overpassEndpoints()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: new URLSearchParams({ data: osmQuery }),
        signal: controller.signal
      });
      const text = await r.text();
      if (!r.ok) {
        failures.push(`${endpoint}:http_${r.status}`);
        continue;
      }
      let data;
      try { data = JSON.parse(text); } catch {
        failures.push(`${endpoint}:invalid_json`);
        continue;
      }

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
          searchAdapter: "overpass",
          endpoint,
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
      return { ok: true, source: "openstreetmap", adapter: "overpass", endpoint, results, fallbackTried: failures.length };
    } catch (error) {
      failures.push(`${endpoint}:${error?.name === "AbortError" ? "timeout" : "network_error"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, source: "overpass", reason: "all_overpass_endpoints_failed", failures };
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
