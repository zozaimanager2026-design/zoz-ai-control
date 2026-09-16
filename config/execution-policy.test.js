const assert = require("assert");
const { EXECUTION_POLICY, chooseProvider, requiresPaidFallback } = require("./execution-policy");

assert.deepStrictEqual(EXECUTION_POLICY.priority, ["free_self_hosted", "free_tier", "paid"]);
assert.strictEqual(chooseProvider([
  { id: "paid", costModel: "paid" },
  { id: "free", costModel: "free_tier" },
  { id: "self", costModel: "free_self_hosted" }
]).id, "self");
assert.strictEqual(requiresPaidFallback({ freeAvailable: true, freeQualityOk: true, freeReliable: true }), false);
assert.strictEqual(requiresPaidFallback({ freeAvailable: true, freeQualityOk: false, freeReliable: true }), true);
console.log("execution policy tests passed");
