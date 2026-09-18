# ZOZ Renderer Service

Standalone deployment target for the ZOZ Creative Engine renderer control plane.

## Usage-based GPU model

ZOZ does not require a permanently rented GPU. The control plane supports an on-demand lifecycle:

1. Queue a render job.
2. Start a GPU worker only when needed (when a lifecycle API is configured).
3. Run image/video inference through the ZOZ-native renderer contract.
4. Record estimated usage and cost in EGP.
5. Stop the GPU worker after the job.
6. Keep asset manifests and render history in the ZOZ renderer state.

The default planning rate is **19.49 EGP/GPU-hour** and is configurable with `ZOZ_GPU_COST_EGP_PER_HOUR`. It is an estimate for planning, not a provider invoice.

## Lifecycle configuration

Optional variables:

- `ZOZ_GPU_START_URL`
- `ZOZ_GPU_STOP_URL`
- `ZOZ_GPU_LIFECYCLE_SECRET`

When these are not configured, ZOZ stays provider-neutral and treats the worker as externally managed. It does not invent provider-specific APIs.

## Cost configuration

- `ZOZ_GPU_COST_EGP_PER_HOUR`
- `ZOZ_CONTROL_COST_EGP_PER_HOUR`
- `ZOZ_STORAGE_COST_EGP_PER_GB_MONTH`

## Control API

- `GET /health`
- `GET /status`
- `GET /cost`
- `GET /gpu`
- `POST /queue`
- `POST /execute`
- `POST /native-image/generate`

The system preserves the existing ZOZ financial approval rule: rendering itself is an operational task; any financial action remains behind human approval.
