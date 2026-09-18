const assert = require("assert");
const meter = require("./cost-meter");

const config = meter.config();
assert.strictEqual(config.currency, "EGP");
assert.strictEqual(config.model, "usage_based");
assert.ok(config.gpuCostEgpPerHour > 0);

const hour = meter.estimateTotal({ gpuDurationMs: 3600000 });
assert.strictEqual(hour.gpuEgp, Number(config.gpuCostEgpPerHour.toFixed(4)));
assert.strictEqual(hour.totalEgp, hour.gpuEgp);

const halfHour = meter.estimateTotal({ gpuDurationMs: 1800000 });
assert.ok(halfHour.totalEgp > 0);
assert.ok(halfHour.totalEgp < hour.totalEgp);

console.log("cost-meter.test.js: OK");
