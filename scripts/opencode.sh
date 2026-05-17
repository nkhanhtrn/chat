#!/bin/bash
set -e

PORT="${OPENCODE_PORT:-4096}"
HOST="${OPENCODE_HOST:-127.0.0.1}"
CORS_ORIGINS="${OPENCODE_CORS:-https://nkhanhtrn.github.io}"
PID_FILE="/tmp/opencode-serve.pid"

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[1;33m'
nc='\033[0m'

info()  { echo -e "${green}$1${nc}"; }
warn()  { echo -e "${yellow}$1${nc}"; }
error() { echo -e "${red}$1${nc}"; }

check_health() {
    curl -sf "http://${HOST}:${PORT}/global/health" 2>/dev/null
}

pids=$(pgrep -f "opencode serve" || true)
if [ -n "$pids" ]; then
    info "Killing opencode server: $(echo $pids | tr '\n' ' ')"
    kill $pids 2>/dev/null || true
    sleep 0.5
    pids=$(pgrep -f "opencode serve" || true)
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
fi
rm -f "$PID_FILE"

CORS_ARGS=()
for origin in $CORS_ORIGINS; do
    CORS_ARGS+=(--cors "$origin")
done

info "Starting opencode server on ${HOST}:${PORT}..."
info "CORS origins: ${CORS_ORIGINS}"
nohup opencode serve --port "$PORT" --hostname "$HOST" "${CORS_ARGS[@]}" > /tmp/opencode-serve.log 2>&1 &
echo $! > "$PID_FILE"
disown

for i in $(seq 1 15); do
    if check_health > /dev/null 2>&1; then
        info "Server ready: http://${HOST}:${PORT}"
        info "API docs:     http://${HOST}:${PORT}/doc"
        exit 0
    fi
    sleep 1
done

error "Server failed to start. Check /tmp/opencode-serve.log"
rm -f "$PID_FILE"
exit 1
