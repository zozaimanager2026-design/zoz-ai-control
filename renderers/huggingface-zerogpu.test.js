const assert = require("assert");
const { generateViaZeroGPU, buildData, findImageValue } = require("./huggingface-zerogpu");

assert.deepStrictEqual(
  buildData({ prompt: "ZOZ test", width: 1024, height: 1024 }),
  ["ZOZ test", "", 42, true, 1024, 1024, 4, 4, 1]
);

assert.deepStrictEqual(findImageValue({ url: "https://example.com/test.png", path: "/tmp/test.png" }).url, "https://example.com/test.png");

const previousFetch = global.fetch;
const calls = [];
global.fetch = async (url, options = {}) => {
  calls.push({ url, options });
  if (String(url).includes("/gradio_api/call/infer")) {
    return {
      status: 200,
      text: async () => JSON.stringify({ event_id: "evt-1" })
    };
  }
  return {
    status: 200,
    text: async () => [
      "event: complete",
      'data: [{"url":"https://example.com/zoz-test.png","path":"/tmp/zoz-test.png","orig_name":"zoz-test.png","mime_type":"image/png"}, 123]'
    ].join("\n")
  };
};

process.env.ZOZ_HF_SPACE_URL = "https://qwen-qwen-image.hf.space";
process.env.ZOZ_HF_API_NAME = "infer";
process.env.ZOZ_HF_PROFILE = "qwen-image";
process.env.ZOZ_HF_MODEL = "Qwen/Qwen-Image";

generateViaZeroGPU({ prompt: "ZOZ integration test", seed: 123 })
  .then(result => {
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.executionMode, "huggingface-zerogpu");
    assert.strictEqual(result.imageUrl, "https://example.com/zoz-test.png");
    assert.strictEqual(result.seed, 123);
    assert.strictEqual(calls.length, 2);
  })
  .finally(() => { global.fetch = previousFetch; })
  .catch(error => { global.fetch = previousFetch; throw error; });
