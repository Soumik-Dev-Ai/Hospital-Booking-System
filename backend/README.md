# Patient Intake & Scheduling Enforcement Backend

Python/FastAPI hybrid architecture: a 24/7 webhook server plus a daily cron enforcement worker.

## Architecture

| Component | Role | Run Command |
|---|---|---|
| `main.py` | Webhook server + frontend API (FastAPI) | `uvicorn main:app --reload` |
| `worker.py` | Background queue consumer (arq/Redis) | `arq worker.QueueWorker` |
| `cron_enforcement.py` | Daily 08:00 enforcement (separate process) | `python cron_enforcement.py --now` |
| `jobs/gmail_watch_renewal.py` | Gmail push subscription renewal (~every 5 days) | `python jobs/gmail_watch_renewal.py` |

## Quick Start

```bash
# 1. Create virtual environment
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and edit env
cp .env.example .env     # if not yet done
# Fill in all variables in .env

# 4. Start PostgreSQL & Redis (Docker recommended)
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=patient_intake postgres:16
docker run -d --name redis -p 6379:6379 redis:7

# 5. Run migrations
alembic upgrade head

# 6. Start all services (3 terminals)
# Terminal 1: Webhook + API server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Background worker
arq worker.QueueWorker --burst

# Terminal 3: Daily cron (or configure as systemd timer)
python cron_enforcement.py --now
```

## Local Webhook Testing with ngrok

Calendly and Pub/Sub must reach your local server:

```bash
ngrok http 8000
```

Then register:
- Calendly webhook: Point at `https://<your-ngrok>.ngrok.io/webhooks/calendly`
- Gmail Pub/Sub subscription: Point at `https://<your-ngrok>.ngrok.io/webhooks/gmail`

## Provisioning

Run the provisioning script **once** to register webhooks:

```bash
python scripts/provision.py
```

This will:
1. Register Calendly webhook subscription
2. Initialize Gmail watch + Pub/Sub push subscription

## dry_run_mode

`dry_run_mode` is a first-class safety toggle — when **true**, the enforcement worker does everything *except* actually calling Calendly's DELETE endpoint. It logs what would have happened.

Toggle it:
- In `.env`: `DRY_RUN_MODE=true`
- Or via API: `PUT /api/settings` with `{"dry_run_mode": true}`

The dashboard and doctor briefing always surface the current mode.

## API Documentation

When running in development mode, Swagger UI is at `http://localhost:8000/docs`.

### Webhooks (public)
- `POST /webhooks/calendly`
- `POST /webhooks/gmail`

### Frontend API (JWT-protected)
- `POST /api/auth/login` — Login with clinic doctor credentials
- `GET /api/dashboard/today` — Today's schedule + compliance overview
- `GET /api/appointments` — List appointments with filtering/pagination
- `GET /api/patients` — List patients
- `GET /api/intake/:appointmentId` — View parsed intake
- `GET /api/briefings` — Past doctor briefings
- `GET /api/audit-log` — Audit trail
- `GET/PUT /api/settings` — Clinic configuration
- `POST /api/cron/trigger` — Manually trigger enforcement worker
- `WS /api/live` — Real-time event feed

## Environment Variables

See `.env.example` for full list. Critical ones:

- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis for queue + cache
- `CALENDLY_WEBHOOK_SIGNING_KEY` — for webhook verification
- `GMAIL_PUSH_AUDIENCE` — for Pub/Sub OIDC token verification
- `GMAIL_REFRESH_TOKEN` — OAuth2 refresh token for Gmail API
- `DRY_RUN_MODE` — set to `false` in production only after testing
- `JWT_SECRET_KEY` — long random string for token signing

## Testing

```bash
pip install -r requirements.txt
pytest tests/ -v
```

Test coverage (see `tests/`):
- `test_security.py` — Calendly HMAC signature verification (valid, tampered, replay, unset-key bypass attempt), Pub/Sub token verification, JWT & password helpers
- `test_calendly_webhook.py` — dedupe by `calendly_event_uuid`, payload validation (missing email/start_time → 400)
- `test_ai_parser.py` — `_core_fields_present`, configurable compliance threshold (reads `ClinicSettings`, falls back to env), `IntakeSummary` schema (out-of-range score rejected)
- `test_cron_enforcement.py` — 48-hour warning boundary (only PENDING, no already-warned); 24-hour reminder (COMPLIANT-only, never changes status); day-of purge (PENDING/WARNED only, never COMPLIANT or NEEDS_MANUAL_REVIEW); dry-run count separation (would_cancel ≠ cancelled); timezone-aware "today" via clinic tz; briefing-ordering source guarantee
- `test_cancel_race.py` — race fix: queue task re-checks status before calling Calendly DELETE; dry-run source-of-truth (DB ClinicSettings wins over env)
- `test_ref_token.py` — `Ref: #<uuid>` regex, hidden-div rendering, `extract_ref_id` parsing, HTML stripped
- `test_briefing.py` — DailyBriefing.date UNIQUE constraint ensures idempotent daily send; briefing counts distinguish dry-run vs actual cancellations; auto-cancellation template grammar regression

## Deployment

- Webhook server: Deploy as Docker container with stable HTTPS domain
- arq worker: Deploy as separate container
- Cron enforcement: Systemd timer or k8s CronJob (not in-process APScheduler). Example unit/timer files:
  ```ini
  # /etc/systemd/system/patient-intake-cron.timer
  [Timer]
  OnCalendar=*-*-* 08:00:00
  Persistent=true
  AccuracySec=1min
  ```
  Set the host timezone to clinic-local (`timedatectl set-timezone America/New_York`) so `08:00` fires clinic-time, since the cron worker computes "today" via `settings.clinic_timezone`.
- Gmail watch renewal: Daily cron (`0 */12 * * *`) since watches expire every 7 days. The renewal job also emails the doctor if a watch will expire within 24h or fails to renew.