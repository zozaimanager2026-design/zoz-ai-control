// ZOZ AI Free-First Video Renderer
// Policy: use local/open-source rendering before paid cloud providers.
// This module is intentionally provider-agnostic and never contains credentials.
const { spawn } = require("node:child_process");

const FREE_RENDERERS = Object.freeze([
  { id: "ffmpeg-local", command: "ffmpeg", kind: "local", priority: 1 },
  { id: "remotion-local", command: "npx", kind: "local", priority: 2, package: "remotion" }
]);

function commandAvailable(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ["-version"], { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function detectFreeRenderers() {
  const result = [];
  if (await commandAvailable("ffmpeg")) result.push({ ...FREE_RENDERERS[0], available: true });
  if (await commandAvailable("npx")) result.push({ ...FREE_RENDERERS[1], available: true });
  return result.sort((a, b) => a.priority - b.priority);
}

async function selectRenderer({ allowCloudFallback = true } = {}) {
  const free = await detectFreeRenderers();
  if (free.length) return { mode: "free", selected: free[0], available: free };
  return {
    mode: allowCloudFallback ? "cloud-fallback" : "blocked",
    selected: null,
    available: [],
    reason: "No local/free renderer is available in the current runtime"
  };
}

module.exports = { FREE_RENDERERS, commandAvailable, detectFreeRenderers, selectRenderer };
