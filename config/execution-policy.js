// ZOZ AI execution policy: free/self-hosted first, paid only when it materially improves
// quality/reliability and no suitable free path exists.
const EXECUTION_POLICY = Object.freeze({
  priority: ["free_self_hosted", "free_tier", "paid"],
  requireApprovalForPaid: true,
  preferPermanentOwnership: true,
  avoidRecurringCostWhenEquivalent: true,
  paidFallbackOnlyWhen: [
    "free_path_unavailable",
    "free_path_unreliable_for_required_quality",
    "paid_option_has_materially_better_required_capability"
  ],
  rendererPreferences: Object.freeze({
    video: ["remotion_self_hosted", "ffmpeg_self_hosted", "free_cloud_tier", "paid_cloud"],
    images: ["local_or_open_source", "free_cloud_tier", "paid_cloud"],
    audio: ["local_or_open_source", "free_tier", "paid"],
    publishing: ["direct_platform_api", "free_connector", "paid_connector"]
  })
});

function rankCostModel(model) {
  const index = EXECUTION_POLICY.priority.indexOf(String(model || "").trim());
  return index === -1 ? EXECUTION_POLICY.priority.length : index;
}

function chooseProvider(providers = []) {
  return [...providers]
    .filter(Boolean)
    .sort((a, b) => rankCostModel(a.costModel) - rankCostModel(b.costModel))[0] || null;
}

function requiresPaidFallback({ freeAvailable, freeQualityOk, freeReliable } = {}) {
  return !(freeAvailable && freeQualityOk && freeReliable);
}

module.exports = { EXECUTION_POLICY, rankCostModel, chooseProvider, requiresPaidFallback };
