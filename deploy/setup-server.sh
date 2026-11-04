#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04 / 24.04 server for SipVault.
# Run as a sudo user:   bash deploy/setup-server.sh
set -euo pipefail

echo ">> Updating packages"
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git ufw rsync

echo ">> Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo ">> Firewall: allow SSH, HTTP, HTTPS only"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable

echo ">> 2 GB swap (helps small servers survive the Next.js build)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo ">> App folder"
sudo mkdir -p /opt/sipvault
sudo chown "$USER":"$USER" /opt/sipvault

echo "Done. Log out and back in (so the docker group applies), then follow README section 7."
