# ZOZ AI Native Image Renderer

This is the image-generation layer owned by ZOZ AI. It runs the diffusion pipeline on ZOZ-controlled compute and returns the rendered image directly to the ZOZ renderer layer.

## Architecture

`ZOZ Creative Engine -> Native Image Renderer -> GPU -> local/cached model -> PNG artifact`

There is no OpenAI image API, Midjourney API, Canva generation API, or other paid image-generation API in this path.

## Runtime

The service uses Hugging Face Diffusers as the local inference runtime. Diffusers supports loading pipelines on CUDA/MPS/CPU and exposing a FastAPI inference endpoint. The model weights are cached locally; production can be configured with `ZOZ_RENDER_MODEL_PATH` and `ZOZ_RENDER_OFFLINE=1` so generation does not require an online model download.

Default model: `Qwen/Qwen-Image`.

For production, place the model on a GPU host, install `requirements.txt`, then run:

```bash
uvicorn server:app --host 0.0.0.0 --port 8100
```

Environment variables:

- `ZOZ_RENDER_MODEL` — model ID for first provisioning.
- `ZOZ_RENDER_MODEL_PATH` — local model path for production/offline operation.
- `ZOZ_RENDER_OUTPUT_DIR` — persistent image output directory.
- `ZOZ_RENDER_INTERNAL_SECRET` — optional service-to-service bearer secret.
- `ZOZ_RENDER_OFFLINE=1` — prevents model download/use of remote model files.

## Production principle

The model is an implementation detail. ZOZ owns the render API, queue, artifacts, brand rules, and routing. Models can be replaced without changing the ZOZ client contract.

The service does not claim unlimited physical compute. ZOZ uses an unlimited logical render queue and executes jobs according to available GPU capacity.
