#!/usr/bin/env bash

# Server-side deploy helper for the two isolated Click & Earn checkouts.
# Run as root so PHP-FPM and Nginx can be safely reloaded:
#   bash /srv/click-and-earn/staging/app/deploy.sh stage
#   bash /srv/click-and-earn/production/app/deploy.sh production

set -Eeuo pipefail

readonly BASE_DIR="/srv/click-and-earn"
readonly REPOSITORY_URL="https://github.com/Ruchie-creator/click-n-earn.git"
readonly BRANCH="main"

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

as_app_user() {
    runuser -u "$SERVICE_USER" -- env HOME="$SERVICE_HOME" "$@"
}

env_value() {
    local key="$1"
    local line value

    line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
    [[ "$line" == *=* ]] || return 0
    value="${line#*=}"

    # Read .env values without sourcing or evaluating the file.
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" == \"*\" && ${#value} -ge 2 ]]; then
        value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && ${#value} -ge 2 ]]; then
        value="${value:1:${#value}-2}"
    fi
    printf '%s' "$value"
}

require_env_value() {
    local key="$1"
    local expected="$2"
    local count value

    count="$(grep -Ec "^${key}=" "$ENV_FILE" || true)"
    [[ "$count" == "1" ]] || die "backend/.env must define $key exactly once."
    value="$(env_value "$key")"
    [[ "$value" == "$expected" ]] || die "backend/.env must set $key to the expected value for $TARGET."
}

require_nonempty_env() {
    local key="$1"
    local count value

    count="$(grep -Ec "^${key}=" "$ENV_FILE" || true)"
    [[ "$count" == "1" ]] || die "backend/.env must define $key exactly once."
    value="$(env_value "$key")"
    [[ -n "$value" ]] || die "backend/.env is missing a value for $key."
}

confirm_production() {
    local confirmation

    cat <<'NOTICE'
Production deployment will update code, build assets, run database migrations,
and reload PHP-FPM/Nginx. Confirm that a recent, restorable PostgreSQL backup
exists and that private proof uploads are backed up before continuing.
NOTICE
    read -r -p 'Type DEPLOY PRODUCTION to continue: ' confirmation
    [[ "$confirmation" == "DEPLOY PRODUCTION" ]] || die "Production deployment cancelled."
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run this script as root on the deployment server."
[[ $# -eq 1 ]] || die "Usage: bash deploy.sh stage|production"

TARGET="$1"
case "$TARGET" in
    stage|staging)
        TARGET="stage"
        ENVIRONMENT="staging"
        SERVICE_USER="clickearn-stage"
        DATABASE_NAME="clickearn_staging"
        DATABASE_USER="clickearn_staging_user"
        DOMAIN="stage.clicknlearn.io"
        CLIENT_PREVIEW="true"
        FPM_SOCKET="/run/php/clickearn-stage.sock"
        FPM_POOL="/etc/php/8.5/fpm/pool.d/clickearn-stage.conf"
        NGINX_SITE="/etc/nginx/sites-enabled/clickearn-stage"
        ;;
    production)
        ENVIRONMENT="production"
        SERVICE_USER="clickearn-prod"
        DATABASE_NAME="clickearn_production"
        DATABASE_USER="clickearn_production_user"
        DOMAIN="clicknlearn.io"
        CLIENT_PREVIEW="false"
        FPM_SOCKET="/run/php/clickearn-prod.sock"
        FPM_POOL="/etc/php/8.5/fpm/pool.d/clickearn-prod.conf"
        NGINX_SITE="/etc/nginx/sites-enabled/clickearn-production"
        ;;
    *)
        die "Unknown target '$TARGET'. Use 'stage' or 'production'."
        ;;
esac

SERVICE_HOME="$BASE_DIR/$ENVIRONMENT"
APP_DIR="$SERVICE_HOME/app"
BACKEND_DIR="$APP_DIR/backend"
ARTISAN="$BACKEND_DIR/artisan"
ENV_FILE="$BACKEND_DIR/.env"
HEALTH_URL="https://$DOMAIN"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

[[ "$SCRIPT_DIR" == "$APP_DIR" ]] || die "Run the checked-out script from $APP_DIR/deploy.sh for target '$TARGET'."
[[ -d "$APP_DIR/.git" ]] || die "No Git checkout found at $APP_DIR."
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE; deploy will not create or overwrite environment files."
[[ -f "$FPM_POOL" ]] || die "Missing PHP-FPM pool config: $FPM_POOL"
[[ -f "$NGINX_SITE" ]] || die "Missing enabled Nginx site: $NGINX_SITE"
[[ "$(stat -c '%U:%a' "$ENV_FILE")" == "$SERVICE_USER:600" ]] || die "$ENV_FILE must be owned by $SERVICE_USER and have mode 600."
id "$SERVICE_USER" >/dev/null 2>&1 || die "Service account $SERVICE_USER does not exist."

require_env_value APP_ENV "$ENVIRONMENT"
require_env_value APP_DEBUG false
require_env_value APP_URL "$HEALTH_URL"
require_env_value FRONTEND_URL "$HEALTH_URL"
require_env_value DB_CONNECTION pgsql
require_env_value DB_DATABASE "$DATABASE_NAME"
require_env_value DB_USERNAME "$DATABASE_USER"
require_nonempty_env DB_PASSWORD

if [[ "$ENVIRONMENT" == "staging" ]]; then
    require_env_value CLIENT_PREVIEW true
    require_env_value DEMO_DATA_ENABLED true
    require_env_value PAYOUT_DRIVER fake
    require_env_value FAKE_PAYOUT_OUTCOME processing
    require_env_value AIRWALLEX_ENVIRONMENT sandbox
else
    require_env_value CLIENT_PREVIEW false
    require_env_value DEMO_DATA_ENABLED false
    require_env_value PAYOUT_DRIVER airwallex
    require_env_value AIRWALLEX_ENVIRONMENT production
    require_env_value AIRWALLEX_PRODUCTION_BASE_URL https://api.airwallex.com
    require_nonempty_env APP_KEY
    require_nonempty_env AIRWALLEX_CLIENT_ID
    require_nonempty_env AIRWALLEX_API_KEY
    require_nonempty_env AIRWALLEX_WEBHOOK_SECRET
    require_nonempty_env MAIL_MAILER
    require_nonempty_env PROOF_STORAGE_DISK

    case "$(env_value MAIL_MAILER)" in
        ''|log|array|null)
            die "Production MAIL_MAILER must use a real delivery provider."
            ;;
    esac

    case "$(env_value PROOF_STORAGE_DISK)" in
        proofs|s3)
            ;;
        *)
            die "Production PROOF_STORAGE_DISK must use the configured private 'proofs' or 's3' disk."
            ;;
    esac
fi

if [[ "$ENVIRONMENT" == "production" ]]; then
    confirm_production
fi

command -v runuser >/dev/null 2>&1 || die "runuser is required."
command -v flock >/dev/null 2>&1 || die "flock is required."
command -v composer >/dev/null 2>&1 || die "Composer is not installed."
command -v npm >/dev/null 2>&1 || die "npm is not installed."
command -v php >/dev/null 2>&1 || die "PHP CLI is not installed."
command -v php-fpm8.5 >/dev/null 2>&1 || die "PHP-FPM 8.5 is not installed."
command -v nginx >/dev/null 2>&1 || die "Nginx is not installed."
command -v systemctl >/dev/null 2>&1 || die "systemctl is not available."
command -v curl >/dev/null 2>&1 || die "curl is not installed."

exec 9>"/run/lock/clickearn-${ENVIRONMENT}-deploy.lock"
flock -n 9 || die "Another $ENVIRONMENT deployment is already running."

REMOTE_URL="$(as_app_user git -C "$APP_DIR" remote get-url origin)"
[[ "$REMOTE_URL" == "$REPOSITORY_URL" ]] || die "Unexpected Git origin for $APP_DIR."
CURRENT_BRANCH="$(as_app_user git -C "$APP_DIR" branch --show-current)"
[[ "$CURRENT_BRANCH" == "$BRANCH" ]] || die "Checkout must be on branch $BRANCH."

WORKTREE_STATUS="$(as_app_user git -C "$APP_DIR" status --porcelain --untracked-files=all)"
[[ -z "$WORKTREE_STATUS" ]] || die "Git checkout has local changes; inspect them before deploying."

printf 'Deploying %s from origin/%s…\n' "$ENVIRONMENT" "$BRANCH"
as_app_user git -C "$APP_DIR" fetch --prune origin "$BRANCH"
FETCHED_COMMIT="$(as_app_user git -C "$APP_DIR" rev-parse FETCH_HEAD)"
CURRENT_COMMIT="$(as_app_user git -C "$APP_DIR" rev-parse HEAD)"
as_app_user git -C "$APP_DIR" merge-base --is-ancestor "$CURRENT_COMMIT" FETCH_HEAD \
    || die "Checkout cannot be fast-forwarded to origin/$BRANCH; refusing deployment."

printf 'Target commit: %s\n' "${FETCHED_COMMIT:0:7}"

# Remove only Laravel's generated config cache so the current .env is re-read.
if [[ -f "$BACKEND_DIR/bootstrap/cache/config.php" && ! -L "$BACKEND_DIR/bootstrap/cache/config.php" ]]; then
    rm -- "$BACKEND_DIR/bootstrap/cache/config.php"
fi

MAINTENANCE_ENABLED=false
cleanup() {
    local status=$?
    trap - EXIT
    if [[ "$MAINTENANCE_ENABLED" == "true" ]]; then
        as_app_user php "$ARTISAN" up >/dev/null || printf 'WARNING: Could not automatically disable Laravel maintenance mode.\n' >&2
    fi
    exit "$status"
}
trap cleanup EXIT

as_app_user php "$ARTISAN" down --retry=60
MAINTENANCE_ENABLED=true

as_app_user git -C "$APP_DIR" merge --ff-only FETCH_HEAD
DEPLOYED_COMMIT="$(as_app_user git -C "$APP_DIR" rev-parse HEAD)"
[[ "$DEPLOYED_COMMIT" == "$FETCHED_COMMIT" ]] || die "Checkout did not reach the fetched commit."

as_app_user composer --working-dir="$BACKEND_DIR" install \
    --no-dev --prefer-dist --optimize-autoloader --no-interaction

as_app_user npm --prefix "$APP_DIR" ci
as_app_user env VITE_API_URL=/api VITE_CLIENT_PREVIEW="$CLIENT_PREVIEW" \
    npm --prefix "$APP_DIR" run build

as_app_user php "$ARTISAN" config:clear
as_app_user php "$ARTISAN" route:clear
as_app_user php "$ARTISAN" view:clear
as_app_user php "$ARTISAN" config:cache
as_app_user php "$ARTISAN" migrate --force

if [[ "$ENVIRONMENT" == "staging" ]]; then
    as_app_user php "$ARTISAN" demo:status
fi

as_app_user php "$ARTISAN" queue:restart
php-fpm8.5 -t
nginx -t
systemctl reload php8.5-fpm
systemctl reload nginx
[[ -S "$FPM_SOCKET" ]] || die "PHP-FPM socket was not created: $FPM_SOCKET"

as_app_user php "$ARTISAN" up
MAINTENANCE_ENABLED=false

curl --fail --silent --show-error --max-time 20 --output /dev/null "$HEALTH_URL/"
curl --fail --silent --show-error --max-time 20 --output /dev/null "$HEALTH_URL/up"

printf 'Deployment succeeded: %s at %s\n' "$ENVIRONMENT" "${DEPLOYED_COMMIT:0:7}"
