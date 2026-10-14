#!/usr/bin/env bash
set -Eeuo pipefail

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

install -m 0644 "$SCRIPT_DIR/click-earn-queue.service" /etc/systemd/system/click-earn-queue.service
install -m 0644 "$SCRIPT_DIR/click-earn-scheduler.service" /etc/systemd/system/click-earn-scheduler.service
systemctl daemon-reload
systemctl enable --now click-earn-queue click-earn-scheduler
systemctl status click-earn-queue click-earn-scheduler --no-pager
