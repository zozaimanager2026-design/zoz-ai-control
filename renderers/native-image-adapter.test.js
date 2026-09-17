const assert = require("assert");
const { renderImage, NATIVE_URL } = require("./native-image-adapter");

assert.ok(NATIVE_URL.startsWith("http"), "native renderer URL must be configured as a URL");
assert.strictEqual(typeof renderImage, "function");

const previousFetch = global.fetch;
global.fetch = async (url, options) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({
    ok: true,
    service: "zoz-native-image-renderer",
    model: "test-model",
    device: "test",
    seed: 7,
    path: "./outputs/test.png",
    filename: "test.png",
    width: 512,
    height: 512,
    elapsed_seconds: 0.1
  })
});

renderImage({ title: "ZOZ test image", width: 512, height: 512, seed: 7 })
  .then(result => {
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.executionMode, "zoz-native-image-renderer");
    assert.strictEqual(result.model, "test-model");
  })
  .finally(() => { global.fetch = previousFetch; });
