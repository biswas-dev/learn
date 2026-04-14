#!/usr/bin/env bash
# Learn adapter for unified project runner
#
# Go + Qwik + SQLite learning platform
# Backend: go run ./cmd/server (port 8080)
# Frontend: npm run dev in frontend/ (port 5173, proxies /api to backend)

PROJECT_NAME="learn"
PROJECT_DOMAIN="learn.biswas.me"
PROJECT_REPO="biswas-dev/learn"
PROJECT_STACK="Go + Qwik + SQLite"
PROJECT_PORT_BACKEND=8080
PROJECT_PORT_FRONTEND=5173
PROJECT_DB="sqlite"

_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_pids="$_dir/.pids"
_log="$_pids/learn.log"

_ensure_pids() { mkdir -p "$_pids"; }

_build_frontend() {
    (cd "$_dir/frontend" && npm run build.client && npm run build.server)
}

_go_env() {
    export LEARN_JWT_SECRET=dev-secret
    export LEARN_DB_PATH="$_dir/data/learn.db"
}

_go_run() {
    _go_env
    (cd "$_dir" && "$@")
}

_start_backend() {
    _ensure_pids
    _go_env
    (cd "$_dir" && go run ./cmd/server >>"$_log" 2>&1 &
        echo $! > "$_pids/backend.pid"
    )
}

_start_frontend_dev() {
    _ensure_pids
    (cd "$_dir/frontend" && npm run dev >>"$_pids/frontend.log" 2>&1 &
        echo $! > "$_pids/frontend.pid"
    )
}

_kill_pid_file() {
    local pidfile="$1"
    if [[ -f "$pidfile" ]]; then
        local pid; pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            # Also kill child processes (go run spawns a child)
            pkill -P "$pid" 2>/dev/null
        fi
        rm -f "$pidfile"
    fi
}

# ── Remote config ────────────────────────────────────────────────
_deploy_path() {
    case "$1" in
        staging) echo "/home/ubuntu/learn-staging" ;;
        uat)     echo "/home/ubuntu/learn-uat" ;;
        prod)    echo "/home/ubuntu/learn" ;;
    esac
}

_api_container() {
    case "$1" in
        staging) echo "learn-staging-learn-1" ;;
        uat)     echo "learn-uat-learn-1" ;;
        prod)    echo "learn-learn-1" ;;
    esac
}

_api_port() {
    case "$1" in
        staging) echo 8080 ;;
        uat)     echo 8080 ;;
        prod)    echo 13426 ;;
    esac
}

# ── Local ─────────────────────────────────────────────────────────
local_start() {
    _build_frontend
    _start_backend
    print_success "learn backend starting on :$PROJECT_PORT_BACKEND (pid: $(cat "$_pids/backend.pid"))"
}

local_stop() {
    _kill_pid_file "$_pids/backend.pid"
    _kill_pid_file "$_pids/frontend.pid"
    # Fallback: kill by port if PID files were stale
    kill_port "$PROJECT_PORT_BACKEND"
    kill_port "$PROJECT_PORT_FRONTEND"
    print_success "learn stopped"
}

local_dev() {
    _build_frontend
    _start_backend
    _start_frontend_dev
    print_success "learn dev: backend :$PROJECT_PORT_BACKEND (pid: $(cat "$_pids/backend.pid")), frontend :$PROJECT_PORT_FRONTEND (pid: $(cat "$_pids/frontend.pid"))"
}

local_restart() {
    local_stop
    sleep 1
    local_start
}

local_status() {
    port_status "$PROJECT_PORT_BACKEND" "backend"
    port_status "$PROJECT_PORT_FRONTEND" "frontend (dev)"
    if [[ -f "$_pids/backend.pid" ]]; then
        local pid; pid=$(cat "$_pids/backend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            echo "  backend pid: $pid"
        else
            echo "  backend pid: $pid (stale)"
        fi
    fi
}

local_logs() {
    if [[ -f "$_log" ]]; then
        tail -f "$_log"
    else
        print_warning "no log file yet — start the server first"
    fi
}

local_test()          { (cd "$_dir" && go test ./internal/...); }
local_test_backend()  { (cd "$_dir" && go test ./internal/...); }
local_test_frontend() { (cd "$_dir/frontend" && npx tsc --noEmit); }

local_db_migrate()    { print_warning "$PROJECT_NAME: SQLite — auto-migrates on startup"; }
local_db_reset()      { rm -f "$_dir/data/learn.db" && print_success "database deleted"; }
local_db_seed()       { print_warning "$PROJECT_NAME: no seed command"; }

local_users() {
    _go_run go run ./cmd/server list-users
}

local_create_admin() {
    local email="$1" password="$2"
    if [[ -z "$email" || -z "$password" ]]; then
        print_error "Usage: create-admin learn <email> <password>"
        return 1
    fi
    _go_run go run ./cmd/server create-admin "$email" "$password"
}

# ── Docker ────────────────────────────────────────────────────────
docker_start()   { (cd "$_dir" && docker compose up -d --build); }
docker_stop()    { (cd "$_dir" && docker compose down); }
docker_status()  { (cd "$_dir" && docker compose ps); }
docker_logs()    { (cd "$_dir" && docker compose logs --tail=100 -f "$@"); }
docker_restart() { (cd "$_dir" && docker compose restart); }

# ── Remote ────────────────────────────────────────────────────────
remote_status() {
    local env="$1" server; server=$(resolve_server "$env") || return 1
    ssh_cmd "$server" "cd '$(_deploy_path "$env")' && docker compose ps"
}

remote_logs() {
    local env="$1"; shift; local server; server=$(resolve_server "$env") || return 1
    ssh_cmd "$server" "cd '$(_deploy_path "$env")' && docker compose logs --tail=100 -f ${1:-}"
}

remote_health() {
    local env="$1" domain="$PROJECT_DOMAIN"
    [[ "$env" == "staging" ]] && domain="staging.$PROJECT_DOMAIN"
    [[ "$env" == "uat" ]]     && domain="uat.$PROJECT_DOMAIN"
    if curl -sf "https://$domain/health" >/dev/null 2>&1; then
        echo -e "  ${GREEN}[healthy]${NC} $PROJECT_NAME  https://$domain"
    else
        echo -e "  ${RED}[down]${NC}    $PROJECT_NAME  https://$domain"
    fi
}

remote_restart() {
    local env="$1" server; server=$(resolve_server "$env") || return 1
    ssh_cmd "$server" "cd '$(_deploy_path "$env")' && docker compose restart"
}

remote_users() {
    local env="$1" server container
    server=$(resolve_server "$env") || return 1
    container=$(_api_container "$env")
    ssh_cmd "$server" "docker exec $container /app/learn list-users"
}

remote_create_admin() {
    local env="$1" email="$2" password="$3"
    local server container

    server=$(resolve_server "$env") || return 1
    container=$(_api_container "$env")

    if [[ -z "$email" || -z "$password" ]]; then
        print_error "Usage: <env> create-admin learn <email> <password>"
        return 1
    fi

    print_status "Creating admin $email on $env..."
    ssh_cmd "$server" "docker exec $container /app/learn create-admin '$email' '$password'" || {
        print_error "Failed to create admin"
        return 1
    }
    print_success "$email is now admin on $env"
}

# copy-db <from_env> <to_env>
copy_db() {
    local from_env="$1" to_env="$2"
    local from_server to_server
    local tmp_file="/tmp/learn-${from_env}-$(date +%s).db"

    from_server=$(resolve_server "$from_env") || return 1
    to_server=$(resolve_server "$to_env") || return 1

    local from_path to_path
    from_path="$(_deploy_path "$from_env")/data/learn.db"
    to_path="$(_deploy_path "$to_env")/data/learn.db"

    print_status "Downloading DB from $from_env..."
    scp -o ConnectTimeout=10 "$from_server:$from_path" "$tmp_file" || {
        print_error "Failed to download DB from $from_env"
        return 1
    }
    local db_size
    db_size=$(ls -lh "$tmp_file" | awk '{print $5}')
    print_status "Downloaded: $db_size"

    print_status "Uploading DB to $to_env..."
    scp -o ConnectTimeout=10 "$tmp_file" "$to_server:$to_path" || {
        print_error "Failed to upload DB to $to_env"
        return 1
    }

    print_status "Restarting $to_env..."
    ssh_cmd "$to_server" "cd '$(_deploy_path "$to_env")' && docker compose restart learn"

    rm -f "$tmp_file"
    print_success "Database copied: $from_env -> $to_env ($db_size)"
}
