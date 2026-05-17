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

is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        rm -f "$PID_FILE"
    fi
    return 1
}

check_health() {
    curl -sf "http://${HOST}:${PORT}/global/health" 2>/dev/null
}

case "${1:-start}" in
    start)
        if is_running; then
            warn "Already running (PID $(cat "$PID_FILE"))"
            info "Server: http://${HOST}:${PORT}"
            exit 0
        fi

        stale=$(pgrep -f "opencode serve" || true)
        if [ -n "$stale" ]; then
            warn "Killing stale opencode processes: $(echo $stale | tr '\n' ' ')"
            kill $stale 2>/dev/null || true
            sleep 0.5
            stale=$(pgrep -f "opencode serve" || true)
            [ -n "$stale" ] && kill -9 $stale 2>/dev/null || true
        fi

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

        error "Server failed to start. Check logs above."
        rm -f "$PID_FILE"
        exit 1
        ;;

    stop)
        pids=$(pgrep -f "opencode serve" || true)
        if [ -n "$pids" ]; then
            info "Killing opencode server processes: $(echo $pids | tr '\n' ' ')"
            kill $pids 2>/dev/null || true
            sleep 0.5
            pids=$(pgrep -f "opencode serve" || true)
            [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
        info "Stopped."
        ;;

    restart)
        $0 stop
        sleep 1
        $0 start
        ;;

    status)
        if is_running; then
            info "Running (PID $(cat "$PID_FILE"))"
            echo ""
            health=$(check_health 2>/dev/null)
            if [ -n "$health" ]; then
                echo "$health" | python3 -m json.tool 2>/dev/null || echo "$health"
            fi
        else
            warn "Not running."
        fi
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
