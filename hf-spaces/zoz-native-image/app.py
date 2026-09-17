import os
import time
import uuid
from pathlib import Path

import gradio as gr
import spaces
import torch
from diffusers import DiffusionPipeline

MODEL_ID = os.getenv("ZOZ_IMAGE_MODEL", "Qwen/Qwen-Image-2512")
OUTPUT_DIR = Path("/tmp/zoz-images")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RENDERER_SECRET = os.getenv("ZOZ_RENDERER_SECRET", "")

pipe = DiffusionPipeline.from_pretrained(
    MODEL_ID,
    dtype=torch.bfloat16,
    device_map="cuda",
)

def _authorized(secret: str) -> bool:
    return not RENDERER_SECRET or secret == RENDERER_SECRET

@spaces.GPU(duration=120)
def generate(prompt, negative_prompt="", width=1024, height=1024, steps=28, guidance_scale=4.0, seed=None, secret=""):
    if not _authorized(str(secret or "")):
        raise gr.Error("unauthorized")

    prompt = str(prompt or "").strip()
    if not prompt:
        raise gr.Error("prompt_required")

    width = max(512, min(int(width or 1024), 1536))
    height = max(512, min(int(height or 1024), 1536))
    steps = max(4, min(int(steps or 28), 50))
    guidance_scale = float(guidance_scale if guidance_scale is not None else 4.0)

    if seed is None or int(seed) < 0:
        seed = int.from_bytes(os.urandom(4), "big")
    else:
        seed = int(seed)

    generator = torch.Generator(device="cuda").manual_seed(seed)
    started = time.time()

    result = pipe(
        prompt=prompt,
        negative_prompt=str(negative_prompt or ""),
        width=width,
        height=height,
        num_inference_steps=steps,
        true_cfg_scale=guidance_scale,
        generator=generator,
    )
    image = result.images[0]

    filename = f"zoz-{uuid.uuid4().hex}.png"
    path = OUTPUT_DIR / filename
    image.save(path, format="PNG")

    return str(path), {
        "service": "zoz-native-image-renderer",
        "model": MODEL_ID,
        "device": "cuda",
        "seed": seed,
        "width": width,
        "height": height,
        "elapsed_seconds": round(time.time() - started, 2),
        "filename": filename,
    }

with gr.Blocks(title="ZOZ Native Image Renderer") as demo:
    gr.Markdown("# ZOZ Native Image Renderer")
    prompt = gr.Textbox(label="Prompt")
    negative = gr.Textbox(label="Negative prompt")
    width = gr.Number(value=1024, label="Width")
    height = gr.Number(value=1024, label="Height")
    steps = gr.Number(value=28, label="Steps")
    guidance = gr.Number(value=4.0, label="Guidance")
    seed = gr.Number(value=-1, label="Seed")
    secret = gr.Textbox(label="ZOZ renderer secret", type="password")
    output = gr.Image(label="Generated image")
    metadata = gr.JSON(label="Metadata")
    btn = gr.Button("Generate")
    btn.click(
        fn=generate,
        inputs=[prompt, negative, width, height, steps, guidance, seed, secret],
        outputs=[output, metadata],
        api_name="generate",
    )

demo.queue().launch()
