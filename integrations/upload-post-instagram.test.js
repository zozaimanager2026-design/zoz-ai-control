const assert = require("assert");

process.env.UPLOAD_POST_PROFILE = "ZozAI";
const adapter = require("./upload-post-instagram");

assert.strictEqual(adapter.PROFILE, "ZozAI");
assert.strictEqual(adapter.PLATFORM, "instagram");
assert.strictEqual(typeof adapter.getProfiles, "function");
assert.strictEqual(typeof adapter.getInstagramStatus, "function");
assert.strictEqual(typeof adapter.getRecentMedia, "function");

console.log("upload-post-instagram adapter checks passed");
