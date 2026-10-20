# Larekmart — Local Setup

The only supported way to run the full stack locally is the root compose
project. Everything below assumes a Docker host (Docker Desktop or a Linux
daemon); the repo itself contains no runnable daemon.

## 1. Environment files (required, none are committed)

Every service loads its configuration with `env_file: ./apps/<name>/.env`
in `docker-compose.yml`. None of these `.env` files are in git — a fresh
clone will fail to start until they exist. 22 workspaces need one
(19 backend services + api-gateway + client + admin), plus the root `.env`:

```bash
pnpm run env:setup   # runs scripts/setup-env.js
```

The script copies every `.env.example` (root, `apps/*`, `packages/*`) to a
sibling `.env` if missing. It never merges: if a workspace gains a new
variable later, delete that workspace's `.env` and re-run, or diff it
against its `.env.example` by hand.

Note: `media-worker` and `media-cleanup` reuse `apps/media-service/.env`,
so 24 `env_file:` references resolve to 22 files.

## 2. Start the stack (single supported command)

```bash
docker compose up -d --build
```

The root `docker-compose.yml` `include:`s the observability, security,
rootprint, traefik, dozzle and caddy files, so this one command starts
databases, Kafka, all services, both frontends, and
Prometheus/Grafana/Loki/Promtail under the single project `larekmart`.

Do NOT also run `pnpm monitoring:up`
(`docker compose -f docker-compose.observability.yml up -d`). It creates a
second compose project with duplicate `container_name`s
(`larekmart-grafana`, `larekmart-loki`, `larekmart-promtail`), one of the
two copies fails to start, and Grafana shows "No data".

## 3. Known issue: `minio/mc` pull failure blocks the ENTIRE stack

`docker-compose.rootprint.yml` defines `minio-init-buckets` with the image
`minio/mc:latest`, which is no longer available on Docker Hub:

```
pull access denied for minio/mc, repository does not exist
```

Because the root `docker-compose.yml` `include:`s the rootprint file,
Compose aborts the whole `docker compose up` when this pull fails. No
service in any file starts — it looks like the entire platform is broken,
but it is this one dead image reference.

Workarounds until the reference is fixed (e.g. switched to
`quay.io/minio/mc`):

```bash
# Option A: start everything except the rootprint services by name
docker compose up -d --build \
  $(docker compose config --services \
    | grep -vE '^(minio|minio-init-buckets|db|quickwit|rootprint)$')

# Option B: comment out the rootprint entry in the include: block
# at the top of docker-compose.yml:
#   # - path: docker-compose.rootprint.yml
```

With rootprint disabled, the Grafana "Quickwit" datasource will error;
nothing else depends on it. The Loki log pipeline and all application
services run fine without it.

## 4. Verify logs are flowing

Run these on the Docker host after startup:

```bash
# 1. Everything should be on the one shared network
docker network inspect larekmart-network \
  --format '{{range .Containers}}{{.Name}} {{end}}'

# 2. Promtail should show the docker_sd job tailing containers, no errors
docker logs larekmart-promtail 2>&1 | tail -50

# 3. Loki should expose the labels set by promtail.yml
#    (expected: container, service, project, stream, job)
curl -s http://localhost:3100/loki/api/v1/labels

# 4. Every application container should appear as a label value
curl -s 'http://localhost:3100/loki/api/v1/label/container/values'
```

Expected noise on first start: Promtail replays any pre-existing container
log backlog, and Loki rejects entries older than 7 days
(`reject_old_samples_max_age: 168h` in `loki.yml`) with HTTP 400
"timestamp too old". A burst of 400s right after the first start is
expected backlog rejection, not a failure — new log lines flow normally.
The `larekmart_promtail_positions` volume keeps Promtail's read positions
across container recreation, so the replay only happens when that volume
is new or has been removed.

In Grafana (http://localhost:3001), the "Larekmart — Service Health"
dashboard has an "Application Logs (Loki)" panel backed by
`{job="larekmart"}`, and the same query works in Explore.
