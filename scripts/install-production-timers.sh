#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -un)" != "syncash" ]]; then
  printf 'Production timers must be installed by the syncash deployment user.\n' >&2
  exit 1
fi

sudo tee /etc/systemd/system/syncash-backup.service >/dev/null <<'EOF'
[Unit]
Description=Encrypted SynCash production backup
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=syncash
Group=syncash
WorkingDirectory=/opt/syncash/current
ExecStart=/opt/syncash/current/scripts/backup-production.sh --daily
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
EOF

sudo tee /etc/systemd/system/syncash-backup.timer >/dev/null <<'EOF'
[Unit]
Description=Daily encrypted SynCash production backup

[Timer]
OnCalendar=*-*-* 02:15:00
Persistent=true
RandomizedDelaySec=15m
Unit=syncash-backup.service

[Install]
WantedBy=timers.target
EOF

sudo tee /etc/systemd/system/syncash-health.service >/dev/null <<'EOF'
[Unit]
Description=SynCash production health verification
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=syncash
Group=syncash
WorkingDirectory=/opt/syncash/current
ExecStart=/opt/syncash/current/scripts/healthcheck-production.sh
EOF

sudo tee /etc/systemd/system/syncash-health.timer >/dev/null <<'EOF'
[Unit]
Description=Periodic SynCash production health verification

[Timer]
OnBootSec=5m
OnUnitActiveSec=5m
AccuracySec=30s
Unit=syncash-health.service

[Install]
WantedBy=timers.target
EOF

sudo systemd-analyze verify /etc/systemd/system/syncash-backup.service /etc/systemd/system/syncash-backup.timer /etc/systemd/system/syncash-health.service /etc/systemd/system/syncash-health.timer
sudo systemctl daemon-reload
sudo systemctl enable --now syncash-backup.timer syncash-health.timer
printf 'SynCash backup and health timers installed.\n'
