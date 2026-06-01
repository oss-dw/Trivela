# Deployment Guide

## Strategies

Set `DEPLOY_STRATEGY` in your `.env` or CI/CD pipeline to choose a deployment mode:

| Value | Description |
|---|---|
| `blue-green` | Zero-downtime. Two containers run side-by-side; nginx shifts traffic after health check. |
| `rolling` | Managed by your orchestrator (Kubernetes, ECS). Not scripted here. |
| `recreate` | Stop old, start new. Accepts a brief outage window. Docker default. |

---

## Blue/Green Deployment

### Overview

Two identical backend environments — **blue** (current live) and **green** (new version) — run simultaneously.
The nginx upstream is pointed at green only after it passes health checks.
Blue is stopped after a settle window with zero errors.

```
[Load Balancer / nginx]
        │
  ┌─────┴─────┐
  │           │
blue:3001   green:3002   ← only one receives live traffic at a time
```

### Running a Blue/Green Deploy

```bash
# Export the image you want to deploy
export DEPLOY_IMAGE=ghcr.io/finesseStudioLab/trivela-backend:v1.2.3
export DEPLOY_STRATEGY=blue-green

# Run the script
bash scripts/deploy-blue-green.sh
```

The script will:
1. Start the green container on port `GREEN_PORT` (default `3002`)
2. Poll `GET /health` until the response contains `"status"` (max 60 s)
3. Rewrite the nginx upstream config and reload nginx
4. Wait `SETTLE_WAIT` seconds (default `30`) watching for error-level logs
5. Stop and remove the old blue container
6. Rename green → blue for the next cycle

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEPLOY_IMAGE` | — | **Required.** Docker image to deploy |
| `DEPLOY_STRATEGY` | `blue-green` | Must be `blue-green` for this script |
| `BLUE_PORT` | `3001` | Port the current live container uses |
| `GREEN_PORT` | `3002` | Port the new container starts on |
| `NGINX_CONF` | `/etc/nginx/conf.d/trivela_upstream.conf` | Upstream config file path |
| `MAX_HEALTH_WAIT` | `60` | Seconds before declaring green unhealthy |
| `SETTLE_WAIT` | `30` | Seconds to watch green before stopping blue |
| `HEALTH_CHECK_URL` | `http://localhost:$GREEN_PORT/health` | Override health URL |

### nginx Upstream Template

`/etc/nginx/conf.d/trivela_upstream.conf` is rewritten by the deploy script.
Initial state (pointing at blue):

```nginx
upstream trivela_backend {
  server 127.0.0.1:3001;
}
```

After cut-over to green:

```nginx
upstream trivela_backend {
  server 127.0.0.1:3002;
}
```

Your main `nginx.conf` references the upstream by name:

```nginx
location /api/ {
  proxy_pass http://trivela_backend;
}
```

### Rollback

The script automatically rolls back on any failure (health timeout, error spike, nginx reload failure).
To manually roll back after a completed deployment, see [RUNBOOK.md](./RUNBOOK.md).

---

## Docker Healthcheck

The backend container exposes `GET /health` → `{"status": "ok"}`.

```yaml
healthcheck:
  test: ['CMD-SHELL', 'curl -sf http://localhost:3001/health | grep -q status || exit 1']
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 10s
```

---

## Restart Policies

### Docker Compose (dev)

```yaml
restart: unless-stopped
```

### Kubernetes

See [docs/KUBERNETES.md](./KUBERNETES.md) for rolling update strategy configuration.