"""ZOZ AI Native Image Renderer.

This service performs image generation on ZOZ-owned compute. It does not call a
commercial image-generation API. A model checkpoint is loaded locally/cached
and inference runs on the available accelerator.
"""
import base64
import io
import os
import time
from pathlib import Path
from typing import Optional

import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from diffusers import DiffusionPipeline

APP_NAME = "zoz-native-image-renderer"
MODEL_ID = os.getenv("ZOZ_RENDER_MODEL", "Qwen/Qwen-Image")
MODEL_PATH = os.getenv("ZOZ_RENDER_MODEL_PATH", "").strip()
OUTPUT_DIR = Path(os.getenv("ZOZ_RENDER_OUTPUT_DIR", "./outputs"))
INTERNAL_SECRET = os.getenv("ZOZ_RENDER_INTERNAL_SECRET", "").strip()
OFFLINE = os.getenv("ZOZ_RENDER_OFFLINE", "0") == "1"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=APP_NAME, version="1.0.0")
_pipeline: Optional[DiffusionPipeline] = None


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    negative_prompt: str = Field(default="", max_length=12000)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=28, ge=1, le=80)
    guidance_scale: float = Field(default=4.0, ge=0.0, le=20.0)
    seed: Optional[int] = Field(default=None, ge=0, le=2**32 - 1)


def device_and_dtype():
    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps", torch.float16
    return "cpu", torch.float32


def pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    device, dtype = device_and_dtype()
    source = MODEL_PATH or MODEL_ID
    kwargs = {"torch_dtype": dtype}
    if OFFLINE:
        kwargs["local_files_only"] = True
    _pipeline = DiffusionPipeline.from_pretrained(source, **kwargs)
    if device == "cuda":
        _pipeline.to(device)
    elif device == "mps":
        _pipeline.to(device)
    else:
        _pipeline.to("cpu")
    return _pipeline


def authorize(authorization: Optional[str]):
    if INTERNAL_SECRET and authorization != f"Bearer {INTERNAL_SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health():
    device, _ = device_and_dtype()
    return {
        "ok": True,
        "service": APP_NAME,
        "status": "ready",
        "device": device,
        "model": MODEL_PATH or MODEL_ID,
        "self_hosted": True,
        "external_generation_api": False,
    }


@app.post("/v1/images/generations")
def generate(request: GenerateRequest, authorization: Optional[str] = Header(default=None)):
    authorize(authorization)
    started = time.time()
    pipe = pipeline()
    device, _ = device_and_dtype()
    seed = request.seed if request.seed is not None else int.from_bytes(os.urandom(4), "big")
    generator = torch.Generator(device=device if device != "mps" else "cpu").manual_seed(seed)
    kwargs = {
        "prompt": request.prompt,
        "height": request.height,
        "width": request.width,
        "num_inference_steps": request.steps,
        "guidance_scale": request.guidance_scale,
        "generator": generator,
    }
    if request.negative_prompt:
        kwargs["negative_prompt"] = request.negative_prompt
    result = pipe(**kwargs)
    image = result.images[0]
    filename = f"zoz-{int(time.time() * 1000)}-{seed}.png"
    path = OUTPUT_DIR / filename
    image.save(path, format="PNG")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return {
        "ok": True,
        "service": APP_NAME,
        "self_hosted": True,
        "external_generation_api": False,
        "model": MODEL_PATH or MODEL_ID,
        "device": device,
        "seed": seed,
        "width": image.width,
        "height": image.height,
        "elapsed_seconds": round(time.time() - started, 3),
        "filename": filename,
        "path": str(path),
        "image_base64": encoded,
    }
