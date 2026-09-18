const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "zoz-asset-store-"));
process.env.ZOZ_ASSET_BACKUP_DIR = temp;
delete process.env.DATABASE_URL;
delete process.env.ZOZ_DATABASE_URL;

const store = require("./asset-store");

(async () => {
  try {
    const input = Buffer.from("ZOZ-IMAGE-TEST").toString("base64");
    const saved = await store.persistImage({
      id: "asset_test_001",
      imageBase64: "data:image/png;base64," + input,
      prompt: "ZOZ asset store test",
      provider: "test"
    });
    assert.strictEqual(saved.ok, true);
    assert.strictEqual(saved.url, "/api/assets/asset_test_001");

    const image = await store.getImage("asset_test_001");
    assert.ok(image);
    assert.strictEqual(image.id, "asset_test_001");
    assert.strictEqual(image.mime_type, "image/png");
    assert.deepStrictEqual(image.bytes, Buffer.from("ZOZ-IMAGE-TEST"));
    assert.strictEqual(image.tier, "filesystem");

    const empty = await store.persistImage({ id: "asset_empty" });
    assert.strictEqual(empty.ok, false);
    assert.strictEqual(empty.reason, "image_source_missing");

    console.log("Asset store tests passed: base64 persistence, read-back, and missing-source guard.");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
