# ZOZ Renderer Service

Standalone deployment target for the ZOZ Creative Engine renderer control plane.

The service is intentionally provider-neutral. Heavy image/video generation is delegated to a configured ZOZ-native worker via environment variables; no paid provider is selected implicitly.
