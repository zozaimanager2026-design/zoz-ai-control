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

async function nominatimSearch({ query = "محلات أدوات كهربائية القاهرة مصر", limit = 10 } = {}) {
  const endpoint = process.env.ZOZ_NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
  const params = new URLSearchParams({
    q: `${query} Cairo Egypt`,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(Math.max(1, Math.min(50, Number(limit) || 10)))
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(`${endpoint}?${params}`, {
      headers: { "User-Agent": "ZOZ-AI-autonomous-lead-search/1.0" },
      signal: controller.signal
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, source: "nominatim", reason: `http_${r.status}` };
    let data;
    try { data = JSON.parse(text); } catch { return { ok: false, source: "nominatim", reason: "invalid_json" }; }
    const results = (Array.isArray(data) ? data : []).map((item) => ({
      name: item.name || item.display_name?.split(",")[0] || "Business",
      title: item.display_name || item.name || "Business",
      source: "openstreetmap",
      searchAdapter: "nominatim",
      endpoint,
      category: item.type || item.class || "business",
      phone: null,
      email: null,
      website: null,
      address: item.display_name || null,
      latitude: item.lat ? Number(item.lat) : null,
      longitude: item.lon ? Number(item.lon) : null,
      query,
      discoveredAt: now()
    }));
    return { ok: true, source: "openstreetmap", adapter: "nominatim", endpoint, results, fallbackTried: 1 };
  } catch (error) {
    return { ok: false, source: "nominatim", reason: error?.name === "AbortError" ? "timeout" : "network_error" };
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
    } catch {}
    finally { clearTimeout(timer); }
  }
  const overpass = await overpassSearch(options);
  if (overpass.ok && overpass.results.length) return overpass;
  const nominatim = await nominatimSearch(options);
  if (nominatim.ok) return { ...nominatim, fallbackTried: (overpass.failures?.length || 0) + 1 };
  return { ok: false, source: "openstreetmap", reason: "all_lead_search_adapters_failed", failures: [...(overpass.failures || []), nominatim.reason] };
}

module.exports = { searchLeads, overpassSearch, nominatimSearch };
