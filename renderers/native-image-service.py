import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="ZOZ Native Image Renderer", version="1.0.0")
OUTPUT_DIR = Path(os.getenv("ZOZ_NATIVE_OUTPUT_DIR", "./outputs"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_ID = os.getenv("ZOZ_IMAGE_MODEL", "").strip()
DEVICE = os.getenv("ZOZ_IMAGE_DEVICE", "cuda")
_SECRET = os.getenv("ZOZ_NATIVE_IMAGE_RENDERER_SECRET", "")
_PIPELINE = None

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    steps: int = 28
    guidance_scale: float = 4.0
    seed: int | None = None


def _auth(value: str | None):
    if _SECRET and value != "Bearer " + _SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


def _load_pipeline():
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    if not MODEL_ID:
        raise RuntimeError("ZOZ_IMAGE_MODEL is not configured")
    try:
        import torch
        from diffusers import AutoPipelineForText2Image
    except Exception as exc:
        raise RuntimeError("native_renderer_dependencies_missing: install renderers/requirements-native.txt") from exc
    dtype = torch.float16 if DEVICE.startswith("cuda") else torch.float32
    pipe = AutoPipelineForText2Image.from_pretrained(MODEL_ID, torch_dtype=dtype)
    pipe = pipe.to(DEVICE)
    _PIPELINE = pipe
    return _PIPELINE


@app.get("/health")
def health():
    return {"ok": True, "service": "zoz-native-image-renderer", "model_configured": bool(MODEL_ID), "device": DEVICE, "output_dir": str(OUTPUT_DIR)}


@app.post("/v1/images/generations")
def generate(req: ImageRequest, authorization: str | None = None):
    _auth(authorization)
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="image_prompt_required")
    if not 256 <= req.width <= 2048 or not 256 <= req.height <= 2048:
        raise HTTPException(status_code=400, detail="image_dimensions_out_of_range")
    if not 1 <= req.steps <= 100:
        raise HTTPException(status_code=400, detail="steps_out_of_range")
    try:
        import torch
        pipe = _load_pipeline()
        generator = None
        seed = req.seed
        if seed is not None:
            generator = torch.Generator(device=DEVICE).manual_seed(int(seed))
        started = time.time()
        image = pipe(prompt=prompt, negative_prompt=req.negative_prompt, width=req.width, height=req.height, num_inference_steps=req.steps, guidance_scale=req.guidance_scale, generator=generator).images[0]
        if seed is None:
            seed = int(torch.randint(0, 2**31 - 1, (1,)).item())
        filename = f"zoz-{int(time.time() * 1000)}-{seed}.png"
        path = OUTPUT_DIR / filename
        image.save(path)
        return {"ok": True, "service": "zoz-native-image-renderer", "model": MODEL_ID, "device": DEVICE, "seed": seed, "path": str(path), "filename": filename, "width": req.width, "height": req.height, "elapsed_seconds": round(time.time() - started, 3)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"native_generation_failed: {exc}") from exc


@app.get("/v1/images/{filename}")
def get_image(filename: str, authorization: str | None = None):
    _auth(authorization)
    path = (OUTPUT_DIR / filename).resolve()
    if OUTPUT_DIR.resolve() not in path.parents:
        raise HTTPException(status_code=400, detail="invalid_filename")
    if not path.exists():
        raise HTTPException(status_code=404, detail="image_not_found")
    return FileResponse(path)
