#!/bin/bash
set -e

PORT="${OPENCODE_PORT:-4096}"
HOST="${OPENCODE_HOST:-127.0.0.1}"
CORS_ORIGINS="${OPENCODE_CORS:-https://nkhanhtrn.github.io}"
PID_FILE="/tmp/opencode-serve.pid"
SERVICE_NAME="opencode.service"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

cmd_setup() {
    mkdir -p "$HOME/.config/systemd/user"
    cp "$SCRIPT_DIR/opencode.service" "$SERVICE_FILE"
    sed -i "s|%h|${HOME}|g" "$SERVICE_FILE"

    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME"
    systemctl --user start "$SERVICE_NAME"
    loginctl enable-linger "$(whoami)" 2>/dev/null || true

    info "Service installed and started."
    info "  status:  systemctl --user status $SERVICE_NAME"
    info "  logs:    journalctl --user -u $SERVICE_NAME -f"
    info "  stop:    systemctl --user stop $SERVICE_NAME"
    info "  disable: systemctl --user disable $SERVICE_NAME"
}

cmd_uninstall() {
    systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl --user daemon-reload
    info "Service uninstalled."
}

case "${1:-run}" in
    setup)
        cmd_setup
        ;;
    uninstall)
        cmd_uninstall
        ;;
    run|*)
        if [ -z "${INVOCATION_ID:-}" ]; then
            pids=$(pgrep -f "opencode serve" || true)
            if [ -n "$pids" ]; then
                info "Killing opencode server: $(echo $pids | tr '\n' ' ')"
                kill $pids 2>/dev/null || true
                sleep 0.5
                pids=$(pgrep -f "opencode serve" || true)
                [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"

        CORS_ARGS=()
        for origin in $CORS_ORIGINS; do
            CORS_ARGS+=(--cors "$origin")
        done

        info "Starting opencode server on ${HOST}:${PORT}..."
        info "CORS origins: ${CORS_ORIGINS}"
        OPENCODE_BIN="${OPENCODE_BIN:-$HOME/.opencode/bin/opencode}"
        nohup "$OPENCODE_BIN" serve --port "$PORT" --hostname "$HOST" "${CORS_ARGS[@]}" > /tmp/opencode-serve.log 2>&1 &
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
        ;;
esac
