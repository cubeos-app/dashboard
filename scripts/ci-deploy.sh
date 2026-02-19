#!/usr/bin/env bash
# =============================================================================
# CubeOS Dashboard — Pi-side deploy script (executed via SSH from GPU VM)
# =============================================================================
# Usage: GHCR_TOKEN=... GHCR_USER=... GHCR_IMAGE=... CI_COMMIT_SHORT_SHA=...
#        bash /tmp/ci-deploy-dashboard.sh
#
# Deploy strategy:
#   1. Stop watchdog timer (prevents interference during deploy)
#   2. stack rm -> wait for drain
#   3. stack deploy with local-only image (no registry prefix)
#   4. Wait for convergence + HTTP health check
#   NOTE: Watchdog restart is handled separately by the CI after_script
#         to ensure it runs even on deploy failure.
# =============================================================================
set -euo pipefail

LOCAL_IMAGE="cubeos-dashboard"
SERVICE_NAME="cubeos-dashboard_cubeos-dashboard"
STACK_NAME="cubeos-dashboard"
COMPOSE_DIR="/cubeos/coreapps/cubeos-dashboard/appconfig"
HEALTH_URL="http://127.0.0.1:6011/"
CONVERGE_TIMEOUT="180"
HEALTH_TIMEOUT="90"

echo "=== Dashboard Deploy (commit ${CI_COMMIT_SHORT_SHA}) ==="

# --- GHCR login ---
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

# === PRE-FLIGHT ===
echo "=== Pre-flight ==="
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
  echo "FATAL: Docker Swarm not active"
  exit 1
fi
echo "  Swarm: active"
if [ ! -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
  echo "FATAL: ${COMPOSE_DIR}/docker-compose.yml not found"
  exit 1
fi
echo "  Compose: found"

# === STOP WATCHDOG ===
echo "=== Stopping watchdog ==="
sudo systemctl stop cubeos-watchdog.timer 2>/dev/null || true
echo "  Watchdog timer stopped"

# === PULL AND RE-TAG AS LOCAL ===
echo "=== Pulling image ==="
docker pull ${GHCR_IMAGE}:${CI_COMMIT_SHORT_SHA}

# Re-tag to local-only name (no registry prefix).
docker tag ${GHCR_IMAGE}:${CI_COMMIT_SHORT_SHA} ${LOCAL_IMAGE}:${CI_COMMIT_SHORT_SHA}
echo "  Tagged: ${LOCAL_IMAGE}:${CI_COMMIT_SHORT_SHA}"

# Verify local image exists
docker image inspect ${LOCAL_IMAGE}:${CI_COMMIT_SHORT_SHA} > /dev/null 2>&1
echo "  Verified: local image present"

# === PREPARE COMPOSE ===
echo "=== Preparing compose ==="
cp ${COMPOSE_DIR}/docker-compose.yml /tmp/deploy-compose.yml

# Replace image line with local-only name
sed -i "s|image:.*dashboard.*|image: ${LOCAL_IMAGE}:${CI_COMMIT_SHORT_SHA}|" /tmp/deploy-compose.yml

echo "  Image tag in compose:"
grep "image:" /tmp/deploy-compose.yml | head -1

# Sanity check
if grep "image:" /tmp/deploy-compose.yml | head -1 | grep -q "ghcr.io\|docker.io"; then
  echo "  FATAL: Compose still references remote registry!"
  exit 1
fi
echo "  Confirmed: local-only image reference"

# === REMOVE OLD STACK ===
echo "=== Removing old stack ==="
docker stack rm ${STACK_NAME} 2>/dev/null || true

# Wait for all containers to drain
set +e
WAIT=0
while [ $WAIT -lt 45 ]; do
  REMAINING=$(docker ps -q \
    --filter "label=com.docker.stack.namespace=${STACK_NAME}" \
    2>/dev/null | wc -l)
  if [ "$REMAINING" -eq 0 ]; then
    echo "  Drained in ${WAIT}s"
    break
  fi
  echo "  ${REMAINING} container(s) draining... (${WAIT}s)"
  sleep 2
  WAIT=$((WAIT + 2))
done

# Force-kill stragglers
STRAGGLERS=$(docker ps -q \
  --filter "label=com.docker.stack.namespace=${STACK_NAME}" \
  2>/dev/null)
if [ -n "$STRAGGLERS" ]; then
  echo "  Force-killing stragglers..."
  echo "$STRAGGLERS" | xargs docker rm -f 2>/dev/null || true
  sleep 3
fi
set -e

# Verify port is free
if ss -tlnp 2>/dev/null | grep -q ":6011 "; then
  echo "  Port 6011 still bound, waiting..."
  sleep 5
fi
echo "  Clean slate"

# === DEPLOY FRESH STACK ===
echo "=== Deploying stack ==="
docker stack deploy \
  --compose-file /tmp/deploy-compose.yml \
  --resolve-image never \
  ${STACK_NAME}
echo "  Stack deployed"

# === WAIT FOR CONVERGENCE ===
echo "=== Waiting for convergence (max ${CONVERGE_TIMEOUT}s) ==="
set +e
ELAPSED=0
CONVERGED=0
FAIL_COUNT=0
while [ $ELAPSED -lt ${CONVERGE_TIMEOUT} ]; do
  STATE=$(docker service ps ${SERVICE_NAME} \
    --filter "desired-state=running" \
    --format "{{.CurrentState}}" 2>/dev/null | head -1)

  case "$STATE" in
    Running*)
      echo "  Converged: ${STATE} (${ELAPSED}s)"
      CONVERGED=1
      break
      ;;
    Starting*)
      echo "  ${STATE} (${ELAPSED}s) - container starting..."
      ;;
    "")
      if [ $ELAPSED -gt 0 ]; then
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "  Task rescheduling (attempt ${FAIL_COUNT}) (${ELAPSED}s)"
        docker service ps ${SERVICE_NAME} --no-trunc \
          --format "    {{.CurrentState}} | {{.Error}}" 2>/dev/null | head -3
      else
        echo "  Scheduling... (${ELAPSED}s)"
      fi
      ;;
    *)
      echo "  ${STATE} (${ELAPSED}s)"
      ;;
  esac

  # Bail on repeated failures
  if [ "$FAIL_COUNT" -ge 3 ]; then
    echo "  ERROR: ${FAIL_COUNT} task failures, aborting"
    docker service ps ${SERVICE_NAME} --no-trunc 2>/dev/null
    docker service logs ${SERVICE_NAME} --tail 20 2>/dev/null || true
    exit 1
  fi

  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
set -e

if [ "$CONVERGED" -ne 1 ]; then
  echo "ERROR: Did not converge within ${CONVERGE_TIMEOUT}s"
  docker service ps ${SERVICE_NAME} --no-trunc 2>/dev/null || true
  docker service logs ${SERVICE_NAME} --tail 30 2>/dev/null || true
  exit 1
fi

# === HTTP HEALTH CHECK ===
echo "=== HTTP health check (max ${HEALTH_TIMEOUT}s) ==="
set +e
ELAPSED=0
HEALTHY=0
while [ $ELAPSED -lt ${HEALTH_TIMEOUT} ]; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" ${HEALTH_URL} 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  HTTP 200 OK (${ELAPSED}s)"
    HEALTHY=1
    break
  fi
  echo "  HTTP ${HTTP_CODE} (${ELAPSED}s)"
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
set -e

if [ "$HEALTHY" -ne 1 ]; then
  echo "ERROR: Health check failed after ${HEALTH_TIMEOUT}s"
  docker service ps ${SERVICE_NAME} --no-trunc 2>/dev/null || true
  docker service logs ${SERVICE_NAME} --tail 50 2>/dev/null || true
  exit 1
fi

# === VERIFY IMAGE ===
echo "=== Verifying ==="
RUNNING_IMAGE=$(docker service inspect ${SERVICE_NAME} \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo "unknown")
EXPECTED="${LOCAL_IMAGE}:${CI_COMMIT_SHORT_SHA}"
echo "  Running:  ${RUNNING_IMAGE}"
echo "  Expected: ${EXPECTED}"
if [ "${RUNNING_IMAGE}" != "${EXPECTED}" ]; then
  echo "  FATAL: Image mismatch - possible watchdog interference"
  exit 1
fi
echo "  Image verified"

# === DONE ===
echo "=== Deploy complete ==="
docker service ls --filter "name=${SERVICE_NAME}"
echo "  Dashboard: http://cubeos.cube"
docker rmi ${GHCR_IMAGE}:${CI_COMMIT_SHORT_SHA} 2>/dev/null || true
docker image prune -f 2>/dev/null || true
df -h / | awk 'NR==2{printf "  Disk free: %s\n", $4}'
