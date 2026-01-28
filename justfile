set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

# Default recipe
default: dev

# Ensure required tools are available and APP_PORT is valid and free
doctor:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "[doctor] Verifying environment..."
    # .env present
    if [[ ! -f .env ]]; then
      echo "ERROR: .env file not found at project root" >&2
      exit 1
    fi

    # APP_PORT defined
    if [[ -z "${APP_PORT:-}" ]]; then
      echo "ERROR: APP_PORT is not set in .env" >&2
      exit 1
    fi
    # APP_PORT is numeric and within valid range
    if ! [[ "$APP_PORT" =~ ^[0-9]+$ ]] || (( APP_PORT < 1 || APP_PORT > 65535 )); then
      echo "ERROR: APP_PORT must be a valid TCP port (1-65535). Current: '$APP_PORT'" >&2
      exit 1
    fi

    # Check that the APP_PORT is not already in use (LISTEN)
    if command -v ss >/dev/null 2>&1; then
      if ss -ltn | awk '{print $4}' | grep -E ":${APP_PORT}$" >/dev/null 2>&1; then
        echo "ERROR: Port $APP_PORT is already in use" >&2
        exit 1
      fi
    elif command -v lsof >/dev/null 2>&1; then
      if lsof -iTCP -sTCP:LISTEN -nP | grep -E ":${APP_PORT}\b" >/dev/null 2>&1; then
        echo "ERROR: Port $APP_PORT is already in use" >&2
        exit 1
      fi
    else
      echo "WARN: Neither 'ss' nor 'lsof' found; skipping port availability check" >&2
    fi

    echo "[doctor] Environment OK. APP_PORT=$APP_PORT"

# Bring up docker services with the available compose command, detached
compose-up:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "[compose] Starting containers..."
    if docker compose version >/dev/null 2>&1; then
      docker compose up -d
    else
      docker-compose up -d
    fi
    echo "[compose] Containers are up (detached)"

# Bring down docker services
compose-down:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "[compose] Stopping containers..."
    if docker compose version >/dev/null 2>&1; then
      docker compose down
    else
      docker-compose down
    fi
    echo "[compose] Containers stopped"
 

start-backend:
    #!/usr/bin/env bash
    set -euo pipefail

    cleanup() {
      echo "[start-backend] Caught termination; cleaning up..."
      just lx-stop || true
      just close-lx-terminal || true
    }
    trap cleanup EXIT INT TERM HUP

    # Run dev server and interpret interrupt signals as a clean exit
    set +e
    yarn dev
    code=$?
    set -e
    if [[ "$code" == "130" || "$code" == "143" ]]; then
      echo "[start-backend] Received interrupt (exit $code). Exiting cleanly."
      exit 0
    fi
    exit "$code"
# One-shot setup: validate, connect VPN, open tunnel, then start backend
dev: doctor open-lx-terminal start-backend
    @echo "[setup] Complete. APP_PORT=$APP_PORT"

# Generate a localxpose config from template using APP_PORT and start tunnel
lx:
    #!/usr/bin/env bash
    set -euo pipefail

    if [[ -z "${APP_PORT:-}" ]]; then
      echo "ERROR: APP_PORT is not set in environment (.env)" >&2
      exit 1
    fi
    # LOCALXPOSE_SUBDOMAIN is optional; if unset we'll remove the subdomain line after templating
    if [[ -z "${LOCALXPOSE_SUBDOMAIN:-}" ]]; then
      echo "[localxpose] INFO: LOCALXPOSE_SUBDOMAIN not set; will omit subdomain from config"
    fi

    tmpl="localxpose.tmpl.yaml"
    out="localxpose.yaml"

    if [[ ! -f "$tmpl" ]]; then
      echo "ERROR: Template not found: $tmpl" >&2
      exit 1
    fi

    echo "[localxpose] Generating $out from $tmpl with APP_PORT=$APP_PORT LOCALXPOSE_SUBDOMAIN=${LOCALXPOSE_SUBDOMAIN:-}"
    # Substitute only APP_PORT and LOCALXPOSE_SUBDOMAIN
    export APP_PORT LOCALXPOSE_SUBDOMAIN
    envsubst '${APP_PORT} ${LOCALXPOSE_SUBDOMAIN}' < "$tmpl" > "$out"
    # If subdomain is empty, remove the line to keep YAML valid
    if [[ -z "${LOCALXPOSE_SUBDOMAIN:-}" ]]; then
      sed -i -e '/^[[:space:]]*subdomain:[[:space:]]*$/d' "$out"
    fi

    echo "[localxpose] Starting tunnel from $out"
    if ! command -v loclx >/dev/null 2>&1; then
      echo "ERROR: 'loclx' not found. Install via 'npm i -g loclx' or see docs." >&2
      exit 1
    fi
    pidfile=".localxpose.pid"
    # Clean up any numbered duplicate PID files (macOS creates these when files conflict)
    rm -f .localxpose\ *.pid .localxpose.term\ *.pid 2>/dev/null || true
    # Ensure any previous stale PID is cleared
    if [[ -f "$pidfile" ]]; then
      oldpid=$(cat "$pidfile" || true)
      if [[ -n "${oldpid:-}" ]] && kill -0 "$oldpid" >/dev/null 2>&1; then
        echo "[localxpose] WARN: An existing localxpose process (PID=$oldpid) appears to be running. Not starting another."
        exit 0
      else
        rm -f "$pidfile" || true
      fi
    fi

    # Trap to cleanup pidfile on termination of this wrapper
    cleanup_lx() {
      rm -f "$pidfile" || true
    }
    trap cleanup_lx EXIT INT TERM HUP

    # Start LocalXpose in background, record PID, and forward output to this terminal
    set +e
    loclx tunnel config -f "$out" &
    lx_pid=$!
    echo "$lx_pid" > "$pidfile"
    echo "[localxpose] Running (PID=$lx_pid). PID stored in $pidfile"
    wait "$lx_pid"
    status=$?
    echo "[localxpose] Exited with status $status"
    exit $status

# Stop LocalXpose started by `just lx`
lx-stop:
    #!/usr/bin/env bash
    set -euo pipefail

    pidfile=".localxpose.pid"
    # Clean up any numbered duplicate PID files (macOS creates these when files conflict)
    rm -f .localxpose\ *.pid 2>/dev/null || true
    if [[ ! -f "$pidfile" ]]; then
      echo "[localxpose] No PID file found; nothing to stop"
      exit 0
    fi
    lx_pid=$(cat "$pidfile" || true)
    if [[ -z "${lx_pid:-}" ]]; then
      rm -f "$pidfile" || true
      echo "[localxpose] Empty PID file removed"
      exit 0
    fi
    if kill -0 "$lx_pid" >/dev/null 2>&1; then
      echo "[localxpose] Stopping LocalXpose (PID=$lx_pid)"
      kill "$lx_pid" >/dev/null 2>&1 || true
      # Give it a moment to exit gracefully, then SIGKILL if needed
      for i in {1..10}; do
        if kill -0 "$lx_pid" >/dev/null 2>&1; then
          sleep 0.2
        else
          break
        fi
      done
      if kill -0 "$lx_pid" >/dev/null 2>&1; then
        echo "[localxpose] Force killing LocalXpose (PID=$lx_pid)"
        kill -9 "$lx_pid" >/dev/null 2>&1 || true
      fi
    else
      echo "[localxpose] Process (PID=$lx_pid) not running"
    fi
    rm -f "$pidfile" || true
    echo "[localxpose] Stopped"

# Open a new terminal window and run `just lx` inside it
open-lx-terminal:
    #!/usr/bin/env bash
    set -euo pipefail

    PROJECT_DIR="$(pwd)"
    CMD="cd \"$PROJECT_DIR\" && just lx"

    term_pid_file=".localxpose.term.pid"
    # Clean up any numbered duplicate PID files (macOS creates these when files conflict)
    rm -f .localxpose\ *.pid .localxpose.term\ *.pid 2>/dev/null || true
    rm -f "$term_pid_file" || true

    if [[ "${OSTYPE:-}" == darwin* ]] && command -v osascript >/dev/null 2>&1; then
      if [[ -d "/Applications/iTerm.app" ]] || [[ -d "$HOME/Applications/iTerm.app" ]]; then
        tmpfile="$(mktemp -t iterm-launch.XXXXXX)"
        if printf '%s\n' \
          "on run argv" \
          "  set runCmd to item 1 of argv" \
          "  tell application \"iTerm\"" \
          "    activate" \
          "    set newWindow to (create window with default profile)" \
          "    tell current session of newWindow" \
          "      write text runCmd" \
          "    end tell" \
          "    return id of newWindow as string" \
          "  end tell" \
          "end run" \
          | osascript - "$CMD" >"$tmpfile"
        then
          iterm_window_id="$(tr -d '\r\n' < "$tmpfile")"
          rm -f "$tmpfile" || true
          if [[ -n "$iterm_window_id" ]]; then
            echo "iterm-window:$iterm_window_id" > "$term_pid_file"
            exit 0
          fi
        else
          rm -f "$tmpfile" || true
          echo "[localxpose] WARN: Failed to launch iTerm window" >&2
        fi
      fi
    fi

    if command -v gnome-terminal >/dev/null 2>&1; then
      gnome-terminal -- bash -lc "$CMD" & echo $! > "$term_pid_file"; exit 0
    fi
    if command -v xfce4-terminal >/dev/null 2>&1; then
      xfce4-terminal -e "bash -lc '$CMD'" & echo $! > "$term_pid_file"; exit 0
    fi
    if command -v konsole >/dev/null 2>&1; then
      konsole -e bash -lc "$CMD" & echo $! > "$term_pid_file"; exit 0
    fi
    if command -v xterm >/dev/null 2>&1; then
      xterm -e bash -lc "$CMD" & echo $! > "$term_pid_file"; exit 0
    fi
    if command -v kitty >/dev/null 2>&1; then
      kitty bash -lc "$CMD" & echo $! > "$term_pid_file"; exit 0
    fi
    if command -v alacritty >/dev/null 2>&1; then
      alacritty -e bash -lc "$CMD" & echo $! > "$term_pid_file"; exit 0
    fi

    echo "[localxpose] WARN: No supported terminal emulator found; running 'just lx' in background" >&2
    bash -lc "$CMD" >/tmp/localxpose.lx.log 2>&1 &
    echo $! > "$term_pid_file"
    disown || true
    echo "[localxpose] 'just lx' launched"

close-lx-terminal:
    #!/usr/bin/env bash
    set -euo pipefail

    term_pid_file=".localxpose.term.pid"
    # Clean up any numbered duplicate PID files (macOS creates these when files conflict)
    rm -f .localxpose.term\ *.pid 2>/dev/null || true
    if [[ ! -f "$term_pid_file" ]]; then
      echo "[localxpose] No terminal PID file found; nothing to close"
      exit 0
    fi
    term_pid=$(cat "$term_pid_file" || true)
    if [[ -z "${term_pid:-}" ]]; then
      rm -f "$term_pid_file" || true
      echo "[localxpose] Empty terminal PID file removed"
      exit 0
    fi
    if [[ "$term_pid" == iterm-window:* ]]; then
      window_id="${term_pid#iterm-window:}"
      if [[ -z "$window_id" ]]; then
        rm -f "$term_pid_file" || true
        echo "[localxpose] Empty iTerm window identifier removed"
        exit 0
      fi
      if [[ "${OSTYPE:-}" == darwin* ]] && command -v osascript >/dev/null 2>&1; then
        if printf '%s\n' \
          "on run argv" \
          "  set targetID to item 1 of argv" \
          "  tell application \"iTerm\"" \
          "    repeat with win in windows" \
          "      if (id of win as string) is targetID then" \
          "        try" \
          "          close win" \
          "        end try" \
          "        exit repeat" \
          "      end if" \
          "    end repeat" \
          "  end tell" \
          "end run" \
          | osascript - "$window_id"
        then
          echo "[localxpose] Closed iTerm window (ID=$window_id)"
        else
          echo "[localxpose] WARN: Failed to close iTerm window (ID=$window_id)" >&2
        fi
      else
        echo "[localxpose] WARN: Unable to control iTerm (missing osascript or unsupported OS)" >&2
      fi
      rm -f "$term_pid_file" || true
      exit 0
    fi
    if kill -0 "$term_pid" >/dev/null 2>&1; then
      echo "[localxpose] Closing terminal window (PID=$term_pid)"
      kill "$term_pid" >/dev/null 2>&1 || true
      for i in {1..10}; do
        if kill -0 "$term_pid" >/dev/null 2>&1; then
          sleep 0.2
        else
          break
        fi
      done
      if kill -0 "$term_pid" >/dev/null 2>&1; then
        echo "[localxpose] Force killing terminal (PID=$term_pid)"
        kill -9 "$term_pid" >/dev/null 2>&1 || true
      fi
    else
      echo "[localxpose] Terminal process (PID=$term_pid) not running"
    fi
    rm -f "$term_pid_file" || true
    echo "[localxpose] Terminal closed"
