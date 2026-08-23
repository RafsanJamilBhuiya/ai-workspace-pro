# AI Workspace Pro API — Phase 3

This service is the server-side boundary for operations that must not run directly from GitHub Pages.

## Implemented

- `GET /health` — unauthenticated health probe.
- `GET /api/v1/me` — HMAC-SHA256 JWT verification for bearer tokens.
- `POST /api/v1/webhooks/events` — HMAC-SHA256 webhook signature verification using `X-Webhook-Signature: sha256=<hex>`.
- `POST /api/v1/tasks` — authenticated task acceptance endpoint.
- JSON payload-size limits and validation.
- Per-client rate limiting with `Retry-After`.
- Security response headers and explicit CORS origin.
- Structured JSON logs for requests, webhooks and tasks.
- Docker container and GitHub Actions validation.

## Required deployment secrets

Set `JWT_SECRET` and `WEBHOOK_SECRET` in the hosting platform's secret manager. Do not commit real values or expose them to browser JavaScript.

## Production scaling note

The included rate limiter is process-local. For multiple replicas, move rate-limit counters and task state to a shared store such as Redis and place the service behind a managed load balancer/API gateway. The task endpoint currently acknowledges work; a durable queue/worker should be attached before treating it as a guaranteed background-job system.
