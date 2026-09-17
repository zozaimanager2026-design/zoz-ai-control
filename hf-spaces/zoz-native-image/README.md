---
title: ZOZ Native Image Renderer
emoji: 🎨
colorFrom: purple
colorTo: blue
sdk: gradio
app_file: app.py
pinned: false
---

# ZOZ Native Image Renderer

ZOZ-owned image generation runtime for Hugging Face ZeroGPU.

Model: Qwen/Qwen-Image-2512 (Apache-2.0). The Space exposes a Gradio API endpoint named `generate` for the ZOZ renderer adapter.

Do not store ZOZ secrets in this repository. Configure `ZOZ_RENDERER_SECRET` as a Space Secret when private authentication is required.
