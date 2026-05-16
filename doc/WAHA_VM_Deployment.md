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
6. [First-Time QR Authentication](#6-first-time-qr-authentication)
7. [Configure Webhook → AlignCore BE](#7-configure-webhook--aligncore-be)
8. [Update AlignCore BE with WAHA URL](#8-update-aligncore-be-with-waha-url)
9. [Verify the Full Flow](#9-verify-the-full-flow)
10. [Keeping WAHA Alive](#10-keeping-waha-alive)
11. [Quick Command Reference](#11-quick-command-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture

```
Demo Phone (WhatsApp)
      │  WebSocket (WhatsApp protocol)
      ▼
┌──────────────────────────────────────┐
│  GCE e2-small  (asia-southeast1)     │
│  External IP: X.X.X.X:3000          │
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

## 6. First-Time QR Authentication

You only need to do this **once**. After the first scan, session data is saved to `~/waha-sessions` and automatically restored on any restart.

### Step 1 — Create the session

Run from your **local machine** (replace `EXTERNAL_IP` and `WAHA_API_KEY`):

```bash
WAHA_URL="http://EXTERNAL_IP:3000"
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
> If `FAILED`, restart the session (see §12) and try again.

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

## 7. Configure Webhook → AlignCore BE

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

## 8. Update AlignCore BE with WAHA URL

### Local dev (`.env` in `aligncore-be/`)

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

## 9. Verify the Full Flow

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
# Expected: {"ok":true,"sentiment":"POSITIVE","health_score_before":0.72,"health_score_after":0.87,...}
```

### Test 2 — Real WhatsApp message

Send a text from the linked phone. Watch:
1. WAHA VM receives it → POSTs to AlignCore BE
2. BE calls Gemini → updates Firestore `relationships/demo-re-001`
3. FE dashboard `onSnapshot` fires → health score animates live

### Check WAHA logs on the VM

```bash
# SSH into the VM
gcloud compute ssh waha-vm --zone=YOUR_ZONE

docker logs waha -f --tail=50
# Look for inbound message lines
```

---

## 10. Keeping WAHA Alive

`--restart=unless-stopped` handles most cases automatically:

| Event | Result |
|---|---|
| WAHA container crashes | Docker restarts it; session resumes from `~/waha-sessions` |
| VM reboots | Docker daemon auto-starts on boot; WAHA resumes session |
| `docker stop waha` (manual) | Does NOT auto-restart — intentional |
| VM is deleted | Session lost — must re-scan QR |

**Before the demo pitch — confirm WAHA is healthy:**

```bash
# From your local machine
curl -s "http://EXTERNAL_IP:3000/api/sessions/aligncore-demo" \
  -H "X-Api-Key: REPLACE_WITH_STRONG_SECRET" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"
# Must print: WORKING
```

---

## 11. Quick Command Reference

```bash
# --- Run these from your local machine ---
WAHA_URL="http://EXTERNAL_IP:3000"
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
```

---

## 12. Troubleshooting

### Session stuck in `SCAN_QR_CODE` — QR expired
```bash
# Get a fresh QR by restarting the session
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/restart" \
  -H "X-Api-Key: $API_KEY"
# Wait 10s, then fetch QR again (§6 Step 3)
```

### Session in `FAILED` state
```bash
# Logout clears old auth; must re-scan QR after
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/logout" \
  -H "X-Api-Key: $API_KEY"
curl -s -X POST "$WAHA_URL/api/sessions/aligncore-demo/start" \
  -H "X-Api-Key: $API_KEY"
# Repeat QR scan (§6)
```

### Cannot reach `http://EXTERNAL_IP:3000`
```bash
# 1. Confirm firewall rule exists
gcloud compute firewall-rules describe allow-waha

# 2. Confirm container is running on the VM
gcloud compute ssh waha-vm --zone=YOUR_ZONE -- docker ps

# 3. If container is not running, start it
gcloud compute ssh waha-vm --zone=YOUR_ZONE -- docker start waha
```

### Webhook not reaching AlignCore BE
```bash
# 1. Test BE reachability from your machine
curl -s "$BE_URL/api/health"

# 2. Check the webhook is configured on the session
curl -s "$WAHA_URL/api/sessions/aligncore-demo" \
  -H "X-Api-Key: $API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['config']['webhooks'], indent=2))"

# 3. Update webhook URL if it changed (§7)
```

### Docker image is stale / WAHA update needed
```bash
# SSH into VM, pull latest image, recreate container
gcloud compute ssh waha-vm --zone=YOUR_ZONE

docker pull devlikeapro/waha:latest
docker stop waha && docker rm waha
# Re-run the docker run command from §5
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
