# ZOZ Native Image Renderer — Free GPU Worker

This is a temporary, zero-cost GPU worker for validating the ZOZ native image-rendering pipeline without PRO, a payment method, or a paid GPU host.

Target environment: Kaggle Notebook with an NVIDIA GPU.

Important:
- This is a validation/bridge worker, not the final permanent production host.
- Kaggle free GPU availability and quotas are controlled by Kaggle and can change.
- The worker is intentionally not exposed as a permanent public production API.
- The ZOZ control plane remains provider-neutral through native-image-adapter.js.
- No financial actions are connected to this worker.

Run:
1. Open Kaggle and create a Notebook.
2. Enable GPU in Notebook settings.
3. Upload/copy app.py and requirements.txt.
4. Install requirements.
5. Start the worker only while actively testing.
6. Point ZOZ_NATIVE_IMAGE_RENDERER_URL to the temporary worker endpoint only after authentication is added and health is verified.

The production ZOZ adapter must not be pointed at an unauthenticated public tunnel.
