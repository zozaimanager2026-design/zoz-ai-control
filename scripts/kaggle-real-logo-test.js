#!/usr/bin/env node
const kaggle = require("../renderers/kaggle-control");
const assetStore = require("../renderers/asset-store");

const kernel = String(process.env.ZOZ_KAGGLE_KERNEL || "").trim();
const token = String(process.env.KAGGLE_API_TOKEN || "").trim();
const apiBase = String(process.env.ZOZ_KAGGLE_API_BASE || "https://www.kaggle.com/api/v1").replace(/\/$/, "");

const python = String.raw`
import os, sys, subprocess, torch
from PIL import Image, ImageDraw, ImageFont
pkgs = ["diffusers", "transformers", "accelerate", "safetensors", "sentencepiece"]
subprocess.run([sys.executable, "-m", "pip", "install", "-q", *pkgs], check=True)
from diffusers import DiffusionPipeline
prompt = "premium futuristic abstract AI control-core emblem for a technology brand, distinctive geometric Z-inspired symbol, intelligent neural network structure, clean negative space, precise symmetry, polished 3D metallic glass surfaces, electric cyan-blue highlights on a deep graphite background, high-end enterprise SaaS identity, minimal iconic professional, centered single symbol, no letters, no words, no watermark, no mockup"
negative = "text, letters, words, typography, watermark, logo mockup, blurry, noisy, cluttered, distorted geometry, extra objects"
pipe = DiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, use_safetensors=True, variant="fp16")
pipe.enable_model_cpu_offload()
image = pipe(prompt=prompt, negative_prompt=negative, width=1024, height=1024, num_inference_steps=28, guidance_scale=6.0, generator=torch.Generator(device="cpu").manual_seed(20260919)).images[0].convert("RGB")
icon_path = "/kaggle/working/zoz_ai_logo_icon.png"
image.save(icon_path, quality=96)
canvas = Image.new("RGB", (1800, 1000), (10, 14, 22))
icon = image.resize((760, 760), Image.Resampling.LANCZOS)
canvas.paste(icon, (90, 120))
draw = ImageDraw.Draw(canvas)
font_candidates = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"]
font_path = next((p for p in font_candidates if os.path.exists(p)), None)
if not font_path: raise RuntimeError("brand_font_not_found")
brand_font = ImageFont.truetype(font_path, 178)
tag_font = ImageFont.truetype(font_path, 42)
draw.text((940, 365), "ZOZ", font=brand_font, fill=(245, 248, 255))
draw.text((940, 555), "AI", font=brand_font, fill=(48, 213, 255))
draw.text((950, 765), "AI BUSINESS OPERATING SYSTEM", font=tag_font, fill=(160, 177, 198))
canvas.save("/kaggle/working/zoz_ai_logo_master.png", quality=98, subsampling=0)
print("ZOZ_REAL_LOGO_READY", "/kaggle/working/zoz_ai_logo_master.png", os.path.getsize("/kaggle/working/zoz_ai_logo_master.png"))
`;

async function waitForKernel(timeoutMs = 1200000, pollMs = 10000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await kaggle.kernelStatus();
    const s = String(last?.result?.status || last?.result?.state || "").toLowerCase();
    if (["complete", "error", "canceled", "cancelled", "failed"].includes(s)) return last;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new Error("kaggle_execution_timeout");
}

function outputFiles(body) {
  return body?.files || body?.outputFiles || body?.result?.files || [];
}

async function extractOutputFile() {
  const result = await kaggle.kernelOutput();
  const body = result.body || {};
  const files = outputFiles(body);
  const file = files.find(f => /zoz_ai_logo_master\.png$/i.test(String(f.fileName || f.filename || f.name || ""))) || files.find(f => /\.png$/i.test(String(f.fileName || f.filename || f.name || "")));
  if (!file) throw new Error("kaggle_output_png_not_found:" + JSON.stringify({ keys: Object.keys(body), files: files.slice(0, 10) }).slice(0, 1800));
  const url = file.url || file.downloadUrl || file.download_url;
  if (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("kaggle_signed_download_failed:" + response.status);
    return Buffer.from(await response.arrayBuffer());
  }
  const parts = kernel.split("/");
  const name = String(file.fileName || file.filename || file.name || "");
  if (parts.length !== 2 || !token || !name) throw new Error("kaggle_output_download_unavailable");
  const path = apiBase + "/kernels/output/download/" + encodeURIComponent(parts[0]) + "/" + encodeURIComponent(parts[1]) + "/" + name.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(path, { headers: { Authorization: "Bearer " + token } });
  if (!response.ok) throw new Error("kaggle_output_download_failed:" + response.status);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  if (!kaggle.configured()) throw new Error("kaggle_not_configured");
  if (!kernel || !kernel.includes("/")) throw new Error("ZOZ_KAGGLE_KERNEL_required_owner_slash_slug");
  if (process.env.ZOZ_KAGGLE_ALLOW_EXECUTE !== "true") throw new Error("kaggle_execution_disabled");

  console.log("[ZOZ_KAGGLE_REAL_LOGO] starting", JSON.stringify({ kernel, model: "stabilityai/stable-diffusion-xl-base-1.0", width: 1024, height: 1024 }));
  const pushed = await kaggle.executeKernelCode(python, {
    kernel,
    newTitle: "ZOZ AI — Real Logo Renderer",
    language: "python",
    kernelType: "script",
    enableGpu: true,
    enableInternet: true,
    isPrivate: true,
    machineShape: "Gpu"
  });
  console.log("[ZOZ_KAGGLE_REAL_LOGO] pushed", JSON.stringify({ ok: pushed.ok, status: pushed.status, bodyKeys: pushed.body ? Object.keys(pushed.body) : [] }));
  if (!pushed.ok) throw new Error("kaggle_push_failed:" + JSON.stringify(pushed.body || {}).slice(0, 1200));

  const done = await waitForKernel();
  console.log("[ZOZ_KAGGLE_REAL_LOGO] execution_done", JSON.stringify(done.result || done));
  const bytes = await extractOutputFile();
  if (!bytes.length) throw new Error("kaggle_logo_empty_output");

  const id = "img_zoz_ai_logo_master_" + Date.now();
  const asset = await assetStore.persistImage({
    id,
    imageBase64: bytes.toString("base64"),
    mimeType: "image/png",
    prompt: "ZOZ AI premium futuristic brand logo master",
    provider: "kaggle-stable-diffusion-xl"
  });
  if (!asset.ok) throw new Error("asset_persist_failed:" + JSON.stringify(asset).slice(0, 1200));
  const loaded = await assetStore.getImage(id);
  console.log("[ZOZ_KAGGLE_REAL_LOGO] SUCCESS", JSON.stringify({
    ok: true,
    id,
    bytes: bytes.length,
    asset: { url: asset.url, primary: asset.primary, backup: asset.backup, tier: asset.tier, sizeBytes: asset.sizeBytes },
    loaded: Boolean(loaded),
    provider: "kaggle-stable-diffusion-xl"
  }));
}

main().catch(error => {
  console.error("[ZOZ_KAGGLE_REAL_LOGO] FAILED", JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
