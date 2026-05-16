# WAHA GOWS — GCE VM Deployment Guide

> **Engine:** GOWS (no browser, ~100 MB RAM, starts in 5–15 s)
> **Instance:** GCE `e2-small` · `asia-southeast1` · Ubuntu 26.04 LTS · ~$0.40 for 24 hours
> **Why VM over Cloud Run:** Sessions persist on disk — no re-scanning QR on restart, no cold-start killing the WhatsApp connection.

---

## Contents

1. [Architecture](#1-architecture)
2. [Create the VM](#2-create-the-vm)
3. [Open Firewall for Port 3000](#3-open-firewall-for-port-3000)
4. [Install Docker on the VM](#4-install-docker-on-the-vm)
5. [Run WAHA](#5-run-waha)
6. [Reverse Proxy with nginx (recommended)](#6-reverse-proxy-with-nginx-recommended)
7. [First-Time QR Authentication](#7-first-time-qr-authentication)
8. [Configure Webhook → AlignCore BE](#8-configure-webhook--aligncore-be)
9. [Update AlignCore BE with WAHA URL](#9-update-aligncore-be-with-waha-url)
10. [Verify the Full Flow](#10-verify-the-full-flow)
11. [Keeping WAHA Alive](#11-keeping-waha-alive)
12. [Quick Command Reference](#12-quick-command-reference)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture

```
Demo Phone (WhatsApp)
      │  WebSocket (WhatsApp protocol)
      ▼
┌──────────────────────────────────────┐
│  GCE e2-small  (asia-southeast1)     │
│  External IP: X.X.X.X                │
│  nginx :80 / :443 → 127.0.0.1:3000   │  ← optional but recommended (§6)
│  Docker: devlikeapro/waha (GOWS)    │
│  Volume: ~/waha-sessions → /app/.sessions │
└────────────────┬─────────────────────┘
                 │  POST /api/waha/webhook
                 ▼
┌──────────────────────────────────────┐
│  Cloud Run: AlignCore BE             │
│  Gemini sentiment → Firestore write  │
└──────────────────────────────────────┘
                 │  onSnapshot
                 ▼
┌──────────────────────────────────────┐
│  Firebase Hosting: FE Dashboard      │
│  Health score animates live          │
└──────────────────────────────────────┘
```

---

## 2. Create the VM

Run these commands from your **local machine** with `gcloud` authenticated.

```bash
# Set project and region once
gcloud config set project YOUR_PROJECT_ID
gcloud config set compute/region asia-southeast1

# Create the VM — try zones in order until one succeeds (stockouts are common)
# Zone -a:
gcloud compute instances create waha-vm \
  --machine-type=e2-small \
  --zone=asia-southeast1-a \
  --image-family=ubuntu-2604-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-standard \
  --tags=waha-server \
  --scopes=cloud-platform

# Zone -b (if -a is exhausted):
# gcloud compute instances create waha-vm \
#   --machine-type=e2-small \
#   --zone=YOUR_ZONE \
#   --image-family=ubuntu-2604-lts-amd64 \
#   --image-project=ubuntu-os-cloud \
#   --boot-disk-size=20GB \
#   --boot-disk-type=pd-standard \
#   --tags=waha-server \
#   --scopes=cloud-platform

# Zone -c (if -b is exhausted):
# gcloud compute instances create waha-vm \
#   --machine-type=e2-small \
#   --zone=asia-southeast1-c \
#   --image-family=ubuntu-2604-lts-amd64 \
#   --image-project=ubuntu-os-cloud \
#   --boot-disk-size=20GB \
#   --boot-disk-type=pd-standard \
#   --tags=waha-server \
#   --scopes=cloud-platform
```

> **Zone stockout:** If all three asia-southeast1 zones fail, use `--zone=asia-southeast2-a` (Jakarta) or `--zone=asia-east1-b` (Taiwan) — latency to the VM is irrelevant for a server-to-server webhook.

Note the **EXTERNAL_IP** from the output — this becomes your WAHA base URL.

```bash
# Get the external IP any time
gcloud compute instances describe waha-vm \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## 3. Open Firewall for Port 3000

This exposes WAHA directly on **TCP 3000**. If you plan to use **nginx on 80/443** only ([§6](#6-reverse-proxy-with-nginx-recommended)), you can skip opening 3000 publicly and rely on `allow-waha-http` instead — after verifying nginx works, delete `allow-waha`.

```bash
gcloud compute firewall-rules create allow-waha \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:3000 \
  --target-tags=waha-server \
  --source-ranges=0.0.0.0/0 \
  --description="WAHA HTTP API and Dashboard"
```

Your WAHA URL will be: `http://EXTERNAL_IP:3000`

After you add nginx ([§6](#6-reverse-proxy-with-nginx-recommended)), prefer **`http://EXTERNAL_IP`** (port 80) or **`https://your-domain`** if you terminate TLS with Certbot.

---

## 4. Install Docker on the VM

SSH into the VM:

```bash
gcloud compute ssh waha-vm --zone=YOUR_ZONE
```

All remaining commands in this section run **inside the VM**.

```bash
# Install Docker (official script — Debian 12)
curl -fsSL https://get.docker.com | sudo bash

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER

# Apply group change without logging out
newgrp docker

# Verify Docker works
docker run --rm hello-world
```

---

## 5. Run WAHA

Still inside the VM:

```bash
# Create a persistent directory for session data
mkdir -p ~/waha-sessions

# Set your secrets as shell variables (replace the values)
WAHA_API_KEY="REPLACE_WITH_STRONG_SECRET"
WAHA_DASHBOARD_PASSWORD="REPLACE_WITH_DASHBOARD_PASSWORD"

# Run WAHA GOWS
docker run -d \
  --name waha \
  --restart=unless-stopped \
  -p 3000:3000 \
  -v ~/waha-sessions:/app/.sessions \
  -e WHATSAPP_DEFAULT_ENGINE=GOWS \
  -e WAHA_API_KEY="$WAHA_API_KEY" \
  -e WAHA_WORKER_ID=waha-vm-1 \
  -e WHATSAPP_RESTART_ALL_SESSIONS=true \
  -e WAHA_PRINT_QR=false \
  -e WAHA_LOG_FORMAT=PRETTY \
  -e WAHA_LOG_LEVEL=info \
  -e WHATSAPP_API_PORT=3000 \
  -e WAHA_DASHBOARD_ENABLED=true \
  -e WAHA_DASHBOARD_USERNAME=admin \
  -e WAHA_DASHBOARD_PASSWORD="$WAHA_DASHBOARD_PASSWORD" \
  devlikeapro/waha:latest
```

**Flags explained:**
- `--restart=unless-stopped` — WAHA auto-restarts if the VM reboots or Docker daemon restarts, without re-scanning QR (session data survives in `~/waha-sessions`)
- `-v ~/waha-sessions:/app/.sessions` — the volume mount that persists your WhatsApp session across container restarts
- `WHATSAPP_RESTART_ALL_SESSIONS=true` — WAHA automatically resumes the last known session on startup

Verify it started:
```bash
docker logs waha --tail=20
# Look for: "WAHA is ready" or "Listening on port 3000"

# From your local machine:
curl -s http://EXTERNAL_IP:3000/api/health
# Expected: {"status":"UP","timestamp":"..."}
```

---

## 6. Reverse Proxy with nginx (recommended)

nginx sits in front of WAHA so you can use **port 80/443**, add **HTTPS** with a domain, and optionally **stop exposing port 3000** on the public internet. WAHA’s dashboard and API use **WebSocket upgrades**; the config below forwards those correctly.

Run **inside the VM** (after [§5](#5-run-waha) works on port 3000).

### Step 1 — Pin WAHA to localhost (optional but recommended)

If WAHA was started with `-p 3000:3000`, recreate the container so it only listens on the loopback interface (not the VM’s external NIC):

```bash
docker stop waha && docker rm waha

mkdir -p ~/waha-sessions
WAHA_API_KEY="REPLACE_WITH_STRONG_SECRET"
WAHA_DASHBOARD_PASSWORD="REPLACE_WITH_DASHBOARD_PASSWORD"

docker run -d \
  --name waha \
  --restart=unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v ~/waha-sessions:/app/.sessions \
  -e WHATSAPP_DEFAULT_ENGINE=GOWS \
  -e WAHA_API_KEY="$WAHA_API_KEY" \
  -e WAHA_WORKER_ID=waha-vm-1 \
  -e WHATSAPP_RESTART_ALL_SESSIONS=true \
  -e WAHA_PRINT_QR=false \
  -e WAHA_LOG_FORMAT=PRETTY \
  -e WAHA_LOG_LEVEL=info \
  -e WHATSAPP_API_PORT=3000 \
  -e WAHA_DASHBOARD_ENABLED=true \
  -e WAHA_DASHBOARD_USERNAME=admin \
  -e WAHA_DASHBOARD_PASSWORD="$WAHA_DASHBOARD_PASSWORD" \
  devlikeapro/waha:latest
```

Keep using **`127.0.0.1:3000`** in `proxy_pass` below.

### Step 2 — Install nginx

```bash
sudo apt update && sudo apt install -y nginx
```

### Step 3 — Site configuration

Create `/etc/nginx/sites-available/waha`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Increase if you upload large attachments through WAHA/API
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket / live dashboard
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Enable it and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/waha /etc/nginx/sites-enabled/waha
sudo rm -f /etc/nginx/sites-enabled/default   # avoid clash with default_server
sudo nginx -t && sudo systemctl reload nginx
```

Quick check from your **local machine**:

```bash
curl -s http://EXTERNAL_IP/api/health
# Expected: {"status":"UP","timestamp":"..."}
```

Dashboard: **`http://EXTERNAL_IP/dashboard`** (same as before, but port 80).

### Step 4 — Firewall: allow HTTP/HTTPS

Create a rule for nginx (adjust if you already allow these elsewhere):

```bash
gcloud compute firewall-rules create allow-waha-http \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --target-tags=waha-server \
  --source-ranges=0.0.0.0/0 \
  --description="WAHA via nginx (HTTP/HTTPS)"
```

If WAHA is bound to **`127.0.0.1:3000`**, you can **delete** the old `allow-waha` rule so **3000 is no longer open on the internet**:

```bash
gcloud compute firewall-rules delete allow-waha
```

### Step 5 — HTTPS with Let’s Encrypt (optional)

Use when you have a **DNS A record** pointing to `EXTERNAL_IP` (e.g. `waha.yourdomain.com`):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d waha.yourdomain.com
```

Certbot edits the nginx server block for TLS. Use **`https://waha.yourdomain.com`** everywhere you previously used `http://EXTERNAL_IP:3000` (AlignCore `WAHA_URL`, webhook testing, dashboard bookmark).

---

## 7. First-Time QR Authentication

You only need to do this **once**. After the first scan, session data is saved to `~/waha-sessions` and automatically restored on any restart.

Set `WAHA_URL` to the **same base URL clients use to reach WAHA**: `http://EXTERNAL_IP:3000` if you skipped nginx, or `http://EXTERNAL_IP` / `https://waha.yourdomain.com` if you completed [§6](#6-reverse-proxy-with-nginx-recommended).

### Step 1 — Create the session

Run from your **local machine** (replace `EXTERNAL_IP` and `WAHA_API_KEY`):

```bash
WAHA_URL="http://EXTERNAL_IP:3000"   # or http://EXTERNAL_IP after nginx; use https if Certbot is enabled
API_KEY="REPLACE_WITH_STRONG_SECRET"

curl -s -X POST "$WAHA_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{
    "name": "aligncore-demo",
    "config": {
      "webhooks": []
    }
  }' | python3 -m json.tool
```

### Step 2 — Start the session

```bash
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/start" \
  -H "X-Api-Key: $API_KEY" | python3 -m json.tool
# Response: {"status":"STARTING"}
```

Wait ~10 seconds for GOWS to initialise, then check status:

```bash
curl -s "$WAHA_URL/api/sessions/aligncore-demo" \
  -H "X-Api-Key: $API_KEY" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"
# Expected: SCAN_QR_CODE
```

### Step 3 — Get the QR code

**Option A — Dashboard (easiest):**
```
Open in browser: http://EXTERNAL_IP:3000/dashboard
  — or, if nginx is in front (§6): http://EXTERNAL_IP/dashboard  (or https://your-domain/dashboard)
Username: admin
Password: REPLACE_WITH_DASHBOARD_PASSWORD
Navigate: Sessions → aligncore-demo → QR Code tab
```

**Option B — Base64 via API:**
```bash
curl -s "$WAHA_URL/api/aligncore-demo/auth/qr" \
  -H "X-Api-Key: $API_KEY" \
  -H "Accept: application/json" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['value'])"
# Paste the data:image/png;base64,... string into any base64-to-image tool
```

> The first QR expires in **60 seconds**, then 20 seconds each refresh. Scan quickly.
> If `FAILED`, restart the session (see §13) and try again.

### Step 4 — Scan with WhatsApp

On the demo phone:
**WhatsApp → Settings → Linked Devices → Link a Device → scan**

### Step 5 — Confirm

```bash
curl -s "$WAHA_URL/api/sessions/aligncore-demo" \
  -H "X-Api-Key: $API_KEY" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"
# Expected: WORKING

# Confirm linked number
curl -s "$WAHA_URL/api/sessions/aligncore-demo/me" \
  -H "X-Api-Key: $API_KEY" | python3 -m json.tool
# Returns: {"id": "601112345678@c.us", "pushName": "Demo Phone"}
```

---

## 8. Configure Webhook → AlignCore BE

Now point WAHA at your AlignCore BE so every inbound WhatsApp message triggers sentiment analysis.

```bash
BE_URL="https://aligncore-be-XXXX-as.a.run.app"   # your Cloud Run BE URL

curl -s -X PUT "$WAHA_URL/api/sessions/aligncore-demo" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d "{
    \"config\": {
      \"webhooks\": [
        {
          \"url\": \"${BE_URL}/api/waha/webhook\",
          \"events\": [\"message\"],
          \"retries\": {
            \"policy\": \"constant\",
            \"delaySeconds\": 2,
            \"attempts\": 5
          }
        }
      ]
    }
  }" | python3 -m json.tool
```

**What WAHA sends to the BE on each inbound message:**
```json
{
  "event": "message",
  "session": "aligncore-demo",
  "payload": {
    "id": "false_601112345678@c.us_ABC123",
    "from": "601112345678@c.us",
    "body": "Great session today! We finalised the fundraising roadmap.",
    "type": "chat",
    "timestamp": 1716800000,
    "fromMe": false
  }
}
```

Your BE reads `payload.body` for Gemini analysis and `payload.from` to identify the sender.

---

## 9. Update AlignCore BE with WAHA URL

### Local dev (`.env` in `aligncore-be/`)

Use the **reachable** WAHA base URL (must match §6 / §7 — include `https://` if you use Certbot).

```bash
WAHA_URL=http://EXTERNAL_IP:3000
WAHA_SESSION=aligncore-demo
```

### Deployed Cloud Run BE

```bash
gcloud run services update aligncore-be \
  --region=asia-southeast1 \
  --update-env-vars="WAHA_URL=http://EXTERNAL_IP:3000,WAHA_SESSION=aligncore-demo"
```

---

## 10. Verify the Full Flow

### Test 1 — Simulate a webhook directly (no phone needed)

```bash
curl -s -X POST "${BE_URL}/api/waha/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message",
    "session": "aligncore-demo",
    "payload": {
      "body": "Great session today! Mapped out Series A fundraising.",
      "from": "601112345678@c.us"
    }
  }' | python3 -m json.tool
# If that phone matches an entity with an active relationship: {"ok":true,"sentiment":"...","health_score":...,"relationship_id":"<firestore-id>"}
# If no matching relationship: {"ok":true,"skipped":"no matching relationship"}
```

### Test 2 — Real WhatsApp message

Send a text from the linked phone. Watch:
1. WAHA VM receives it → POSTs to AlignCore BE
2. BE resolves the **`relationships/{id}`** doc (group `wa_group_id`, or DM phone → mentor/company), calls Gemini → updates that doc
3. FE dashboard `onSnapshot` fires → health score animates live

### Check WAHA logs on the VM

```bash
# SSH into the VM
gcloud compute ssh waha-vm --zone=YOUR_ZONE

docker logs waha -f --tail=50
# Look for inbound message lines
```

---

## 11. Keeping WAHA Alive

`--restart=unless-stopped` handles most cases automatically:

| Event | Result |
|---|---|
| WAHA container crashes | Docker restarts it; session resumes from `~/waha-sessions` |
| VM reboots | Docker daemon auto-starts on boot; WAHA resumes session |
| `docker stop waha` (manual) | Does NOT auto-restart — intentional |
| VM is deleted | Session lost — must re-scan QR |

**Before the demo pitch — confirm WAHA is healthy:**

```bash
# From your local machine (same WAHA_URL style as §7 — omit :3000 if using nginx on port 80)
curl -s "$WAHA_URL/api/sessions/aligncore-demo" \
  -H "X-Api-Key: REPLACE_WITH_STRONG_SECRET" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"
# Must print: WORKING
```

---

## 12. Quick Command Reference

```bash
# --- Run these from your local machine ---
WAHA_URL="http://EXTERNAL_IP:3000"   # or http://EXTERNAL_IP / https://your-domain after §6
API_KEY="REPLACE_WITH_STRONG_SECRET"
BE_URL="https://aligncore-be-XXXX-as.a.run.app"

# Health check
curl -s -H "X-Api-Key: $API_KEY" "$WAHA_URL/api/health"

# Session status
curl -s -H "X-Api-Key: $API_KEY" "$WAHA_URL/api/sessions/aligncore-demo" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"

# Start session
curl -s -X POST -H "X-Api-Key: $API_KEY" \
  "$WAHA_URL/api/sessions/aligncore-demo/start"

# Restart session (fresh QR)
curl -s -X POST -H "X-Api-Key: $API_KEY" \
  "$WAHA_URL/api/sessions/aligncore-demo/restart"

# Get QR as base64
curl -s -H "X-Api-Key: $API_KEY" -H "Accept: application/json" \
  "$WAHA_URL/api/aligncore-demo/auth/qr"

# Simulate positive WhatsApp message (no phone needed)
curl -s -X POST "$BE_URL/api/waha/webhook" \
  -H "Content-Type: application/json" \
  -d '{"event":"message","session":"aligncore-demo","payload":{"body":"Great session! We finalised the manufacturing roadmap.","from":"601112345678@c.us"}}'

# --- Run these inside the VM (gcloud compute ssh waha-vm) ---

# View WAHA logs live
docker logs waha -f

# Restart WAHA container
docker restart waha

# Check session files are persisted
ls ~/waha-sessions/

# nginx (after §6): test config / reload after edits
sudo nginx -t && sudo systemctl reload nginx
sudo journalctl -u nginx -n 30 --no-pager
```

---

## 13. Troubleshooting

### Session stuck in `SCAN_QR_CODE` — QR expired
```bash
# Get a fresh QR by restarting the session
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/restart" \
  -H "X-Api-Key: $API_KEY"
# Wait 10s, then fetch QR again (§7 Step 3)
```

### Session in `FAILED` state
```bash
# Logout clears old auth; must re-scan QR after
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/logout" \
  -H "X-Api-Key: $API_KEY"
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/start" \
  -H "X-Api-Key: $API_KEY"
# Repeat QR scan (§7)
```

### Cannot reach WAHA (`http://EXTERNAL_IP:3000`, `http://EXTERNAL_IP`, or HTTPS)

```bash
# 1. Confirm a firewall rule allows the port you use:
gcloud compute firewall-rules describe allow-waha          # tcp:3000
gcloud compute firewall-rules describe allow-waha-http    # tcp:80,443 after §6

# 2. Confirm WAHA is listening (inside VM)
gcloud compute ssh waha-vm --zone=YOUR_ZONE -- curl -s http://127.0.0.1:3000/api/health

# 3. If §6 nginx is enabled, confirm nginx proxies correctly (inside VM)
gcloud compute ssh waha-vm --zone=YOUR_ZONE -- curl -s http://127.0.0.1/api/health

# 4. Confirm container is running
gcloud compute ssh waha-vm --zone=YOUR_ZONE -- docker ps

# 5. If container is not running, start it
gcloud compute ssh waha-vm --zone=YOUR_ZONE -- docker start waha
```

### nginx returns `502 Bad Gateway`

Usually nginx cannot reach WAHA on `127.0.0.1:3000` (container stopped, wrong bind, or WAHA still starting).

```bash
gcloud compute ssh waha-vm --zone=YOUR_ZONE
sudo nginx -t
sudo systemctl status nginx --no-pager
curl -s http://127.0.0.1:3000/api/health
docker logs waha --tail=40
```

### Webhook not reaching AlignCore BE
```bash
# 1. Test BE reachability from your machine
curl -s "$BE_URL/api/health"

# 2. Check the webhook is configured on the session
curl -s "$WAHA_URL/api/sessions/aligncore-demo" \
  -H "X-Api-Key: $API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['config']['webhooks'], indent=2))"

# 3. Update webhook URL if it changed (§8)
```

### Docker image is stale / WAHA update needed
```bash
# SSH into VM, pull latest image, recreate container
gcloud compute ssh waha-vm --zone=YOUR_ZONE

docker pull devlikeapro/waha:latest
docker stop waha && docker rm waha
# Re-run the docker run from §5 (direct port 3000) or §6 Step 1 (127.0.0.1:3000 + nginx)
# Session data in ~/waha-sessions is safe — the volume persists
```

### VM costs — stop the VM when not needed
```bash
# Stop (you are NOT charged for VM compute while stopped, only disk ~$0.04/day)
gcloud compute instances stop waha-vm --zone=YOUR_ZONE

# Start again before the demo
gcloud compute instances start waha-vm --zone=YOUR_ZONE
# WAHA auto-starts; session resumes in ~15s — confirm status before pitching
```

---

*Sources: [WAHA Sessions API](https://waha.devlike.pro/docs/how-to/sessions/) · [GOWS Engine](https://waha.devlike.pro/docs/engines/gows/) · [WAHA Config](https://waha.devlike.pro/docs/how-to/config/) · [Cloud Run Feasibility Discussion #817](https://github.com/devlikeapro/waha/discussions/817)*
