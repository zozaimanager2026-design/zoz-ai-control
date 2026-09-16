const assert = require("assert");
const { PROVIDERS, rendererStatus } = require("./video-cloud-adapter");

assert(PROVIDERS.creatomate.endpoint.includes("api.creatomate.com"));
assert(PROVIDERS.shotstack.endpoint.includes("api.shotstack.io"));
assert.strictEqual(rendererStatus().mode, "external-cloud");
console.log("video-cloud-adapter.test.js: OK");
