// ZOZ AI independent cloud video renderer adapter.
// Core remains provider-agnostic; this worker can use a managed renderer outside Railway.
// Supported providers: creatomate, shotstack. No secrets are stored in source control.

const PROVIDERS = Object.freeze({
  creatomate: { endpoint: "https://api.creatomate.com/v2/renders", keyEnv: "CREATOMATE_API_KEY", auth: "bearer" },
  shotstack: { endpoint: "https://api.shotstack.io/v1/render", keyEnv: "SHOTSTACK_API_KEY", auth: "x-api-key" }
});

function providerConfig(name = process.env.ZOZ_VIDEO_RENDER_PROVIDER || "creatomate") {
  const key = String(name).toLowerCase();
  const config = PROVIDERS[key];
  if (!config) throw new Error(`Unsupported video renderer provider: ${key}`);
  const apiKey = process.env[config.keyEnv];
  if (!apiKey) throw new Error(`${config.keyEnv} is not configured`);
  return { name: key, ...config, apiKey };
}

async function renderWithCloudProvider(payload, options = {}) {
  const config = providerConfig(options.provider);
  const body = options.body || payload;
  const headers = { "Content-Type": "application/json" };
  if (config.auth === "x-api-key") headers["x-api-key"] = config.apiKey;
  else headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetch(config.endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(`Cloud renderer ${config.name} returned HTTP ${response.status}`);
    error.provider = config.name;
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return { provider: config.name, ...data };
}

function rendererStatus() {
  const configured = Object.entries(PROVIDERS).filter(([, cfg]) => Boolean(process.env[cfg.keyEnv])).map(([name]) => name);
  return { mode: "external-cloud", configuredProviders: configured, preferredProvider: process.env.ZOZ_VIDEO_RENDER_PROVIDER || "creatomate" };
}

module.exports = { PROVIDERS, providerConfig, renderWithCloudProvider, rendererStatus };
