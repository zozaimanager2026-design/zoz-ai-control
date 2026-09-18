// ZOZ Creative Engine — usage-based cost accounting.
// These are configurable estimates, not a billing statement from any provider.
const GPU_COST_EGP_PER_HOUR = Number(process.env.ZOZ_GPU_COST_EGP_PER_HOUR || 19.49);
const STORAGE_COST_EGP_PER_GB_MONTH = Number(process.env.ZOZ_STORAGE_COST_EGP_PER_GB_MONTH || 0);
const CONTROL_COST_EGP_PER_HOUR = Number(process.env.ZOZ_CONTROL_COST_EGP_PER_HOUR || 0);

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function estimateGpuCost({ durationMs = 0, rateEgpPerHour = GPU_COST_EGP_PER_HOUR } = {}) {
  const ms = safeNumber(durationMs);
  const rate = safeNumber(rateEgpPerHour, GPU_COST_EGP_PER_HOUR);
  return (ms / 3600000) * rate;
}

function estimateStorageCost({ gb = 0, days = 0, rateEgpPerGbMonth = STORAGE_COST_EGP_PER_GB_MONTH } = {}) {
  const size = safeNumber(gb);
  const durationDays = safeNumber(days);
  const rate = safeNumber(rateEgpPerGbMonth, STORAGE_COST_EGP_PER_GB_MONTH);
  return size * (durationDays / 30) * rate;
}

function estimateTotal({ gpuDurationMs = 0, controlDurationMs = 0, storageGb = 0, storageDays = 0 } = {}) {
  const gpu = estimateGpuCost({ durationMs: gpuDurationMs });
  const control = estimateGpuCost({ durationMs: controlDurationMs, rateEgpPerHour: CONTROL_COST_EGP_PER_HOUR });
  const storage = estimateStorageCost({ gb: storageGb, days: storageDays });
  return {
    gpuEgp: Number(gpu.toFixed(4)),
    controlEgp: Number(control.toFixed(4)),
    storageEgp: Number(storage.toFixed(4)),
    totalEgp: Number((gpu + control + storage).toFixed(4)),
    estimated: true
  };
}

function config() {
  return {
    currency: "EGP",
    model: "usage_based",
    gpuCostEgpPerHour: GPU_COST_EGP_PER_HOUR,
    controlCostEgpPerHour: CONTROL_COST_EGP_PER_HOUR,
    storageCostEgpPerGbMonth: STORAGE_COST_EGP_PER_GB_MONTH,
    note: "Rates are configurable estimates; provider invoices are authoritative."
  };
}

module.exports = { config, estimateGpuCost, estimateStorageCost, estimateTotal };
