# Global Supply Chain Platform

Full-stack role-based supply chain platform with:
- React + Vite frontend
- FastAPI backend
- JWT auth + OTP signup flow
- Guest access flow
- Dashboard modules for Admin, Manufacturer, Transporter, Dealer, Retail

## Project Structure

```text
Global Supply  Chain project/
  backend/
    app/
      api/
      core/
      models/
      services/
    data/
    requirements.txt
    run.py
  frontend/
    src/
    package.json
    vite.config.js
```

## Tech Stack

- Frontend: React 19, Vite
- Backend: FastAPI, Uvicorn, python-jose
- Database: SQLite (default local dev via `sqlite:///./local.db`) or PostgreSQL via `DATABASE_URL` (Render-ready)
- Auth: JWT bearer tokens + OTP email verification
- Realtime: WebSocket GPS feed (`/ws/gps`) + notifications (`/ws/notifications/{userId}`)
- AI & Visualization: Claude-backed forecasts, blockchain QR timeline, and live ETA countdown with baseline fallbacks

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm

## Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Note: `python run.py` defaults `UVICORN_RELOAD` to `false` to keep OTP state stable on Windows. To enable auto-reload: `$env:UVICORN_RELOAD="true"`.

Logging note: by default the backend runs with quieter logs (to avoid noisy request + WebSocket connect spam during demos). You can re-enable them:
- `$env:UVICORN_LOG_LEVEL="info"`
- `$env:UVICORN_ACCESS_LOG="true"`

Backend runs on: `http://localhost:8000`

By default the backend points `DATABASE_URL` at `sqlite:///./local.db` (with `SQLITE_DB_PATH=local.db`), so you can run without a Postgres server and still take advantage of SQLite's file-based storage. If you see repeated `ECONNREFUSED` or `WinError 10013` messages, verify port `8000` is free before relaunching the server (the troubleshooting section below walks through `netstat` and `Stop-Process`).

Useful endpoints:
- Health: `GET /health`
- OpenAPI docs: `GET /docs`
- Health should return database info (`database: connected`) when DB is reachable, plus `email.mock` and `ai.enabled`/`ai.provider` so you can confirm configuration.

### Backend Startup Troubleshooting (`WinError 10013`)

If you see:

```text
ERROR: [WinError 10013] An attempt was made to access a socket in a way forbidden by its access permissions
```

it usually means port `8000` is already in use or blocked.

Use:

```powershell
netstat -ano | findstr :8000
tasklist /FI "PID eq <PID>"
```

Then either stop that process:

```powershell
Stop-Process -Id <PID> -Force
python run.py
```

or run backend on another port:

```powershell
$env:UVICORN_PORT="8001"
python run.py
```

If backend is on a non-default port, align frontend proxy target:

```powershell
$env:VITE_DEV_PROXY_TARGET="http://127.0.0.1:8001"
cd frontend
npm run dev
```

## Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on default Vite port (usually `http://localhost:5173`).
Frontend uses Vite proxy to call backend (`/api` and `/ws` -> `http://localhost:8000` by default).

Windows PowerShell note: if you see `npm` blocked by execution policy, run `npm.cmd run dev` instead.

## Helper Functions

- FastAPI dependencies like `SendOTPRequest`, `LoginRequest`, and `VerifyOTPRequest` are declared before their routers and wired directly into each signature, so FastAPI never sees `ForwardRef` objects while `_build_otp_response` continues to centralize OTP delivery, duplicate detection, and optional dev output.
- `_build_otp_response(data)` remains the single gateway for `/auth/send-otp` and `/auth/resend-otp`, handling the user lookup, OTP issuance, and email delivery guardrails before returning the success payload.
- `app/services/ai_service.py` orchestrates AI requests for demand forecasts, delay-risk scoring, low-stock recommendations, and journey summaries; when no AI key is configured it falls back to deterministic baselines so the dashboards still show sensible numbers.
- `_normalize_database_url()`, `_current_database_url()`, and `_engine()` try the configured `DATABASE_URL` first and revert to `sqlite:///./local.db` (driven by `SQLITE_DB_PATH=local.db`) if the remote store is unreachable, keeping the health check honest.
- Utility helpers such as `normalize_email`, `normalize_role`, password hashing, and token creation stay close to the routers so you can track the auth flow end-to-end.

## Environment Variables

### Backend (optional)

- `APP_ENV` (default: `development`)
- `SECRET_KEY`
- `JWT_ALGORITHM` (default: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: `60`)
- `DATABASE_URL` (defaults to `sqlite:///./local.db` locally; override with a Postgres URL for production)
- `SQLITE_DB_PATH` (default: `local.db`)
- `BLOCKCHAIN_SALT` (hash salt for ledger signatures)
- `ALLOWED_ORIGINS` / `CORS_ORIGINS` (comma-separated list; defaults to `http://localhost:5173,http://127.0.0.1:5173`)
- `AI_PROVIDER` (optional; `auto|anthropic|gemini`; default: `auto`)
- `ANTHROPIC_API_KEY` (for Claude-powered AI integrations; leave blank to keep the baseline forecasts and summaries)
- `ANTHROPIC_MODEL` (optional override; default: `claude-opus-4-6`)
- `GEMINI_API_KEY` (for Gemini-powered AI integrations; leave blank to keep the baseline forecasts and summaries)
- `GEMINI_MODEL` (optional override; default: `gemini-2.0-flash`)
- `UVICORN_HOST` (default: `127.0.0.1`)
- `UVICORN_PORT` (default: `8000`)
- `UVICORN_LOG_LEVEL` (default: `warning`)
- `UVICORN_ACCESS_LOG` (default: `false`)

Providing an AI key enables the backend AI helpers; when missing they gracefully return the mean-based baselines defined in `app/services/ai_service.py`. If the key is invalid (HTTP `401/403`), the backend temporarily disables AI calls for ~10 minutes to avoid log spam; fix the key and restart the backend.
- `MOCK_EMAIL_DELIVERY` (default in this repo: `false`). When `true`, emails are printed to the console instead of sending. When `false`, thank-you emails and OTP emails send via SMTP; failures are logged and `/api/auth/feedback` returns `email_sent: false` + `email_error` instead of failing the request.
- `SMTP_SERVER`, `SMTP_PORT`, `SENDER_EMAIL`, `SENDER_PASSWORD`, `SENDER_NAME`

To validate SMTP quickly (from your machine), use:

```powershell
cd backend
python scripts/smtp_check.py --to you@example.com --dry-run
python scripts/smtp_check.py --to you@example.com
```

If you're using Gmail as the relay, `SENDER_PASSWORD` must be a Gmail App Password (you need 2-Step Verification enabled). A normal Gmail password will fail or disconnect.
Tip: Google displays app passwords with spaces; you can paste it as-is or without spaces (the backend strips spaces automatically).
If you still see `EMAIL MOCK` in the backend logs while `MOCK_EMAIL_DELIVERY=false`, check for a Windows/user environment variable overriding it (shell env vars beat `.env` files); restart the backend after changing any `.env` values.

### Frontend (optional)

- `VITE_API_BASE_URL` (default: `/api`)
- `VITE_GPS_SOCKET_URL` (default: browser host + `/ws/gps`)
- `VITE_DEV_PROXY_TARGET` (default in Vite config: `http://localhost:8000`)
- `VITE_NOTIFICATION_SOCKET_PING_MS` (default: `20000`) keepalive ping for `/ws/notifications/*`

### Secrets and `.env`

- Put sensitive keys in `.env` (example: `ANTHROPIC_API_KEY=...` or `GEMINI_API_KEY=...`).
- `.env` is ignored by git (`.gitignore` includes `.env` and `.env.*`).
- Use `.env.example` files for safe placeholders only.
- `.env.example` files in this repo use placeholders (never real keys). Set real values in your shell or local `backend/.env` copy so secrets never land in source control.
- The backend loads both `./.env` and `backend/.env`; if the same key appears in both files, `backend/.env` wins (shell environment variables still win over both).
- If any credential is ever committed to git history, rotate/revoke it immediately and replace it in your local `backend/.env` (never commit real keys).

### Render PostgreSQL Setup

1. Create a free PostgreSQL service in Render.
2. Copy the correct database URL from Render:
   - **Backend running on Render**: use the **Internal Database URL**.
   - **Backend running on your laptop/PC**: use the **External Database URL** (typically includes a `*.render.com` hostname and may require `?sslmode=require`).
3. Set backend environment variable `DATABASE_URL` to that URL (prefer `backend/.env` locally, or Render "Environment" variables when deployed).
4. Keep `SQLITE_DB_PATH` only as local fallback.
5. Restart the backend service. On startup, tables are auto-created via SQLAlchemy.

Troubleshooting:
- If the backend falls back to SQLite, first verify your network can reach the Render DB host on port `5432`:
  - `Test-NetConnection <your-render-db-hostname> -Port 5432`
  - Many office/college networks block outbound `5432`; try a mobile hotspot/VPN or deploy the backend on Render and use the Internal Database URL.

For local development you can skip Postgres entirely: leave `DATABASE_URL` unset and the backend uses SQLite via `SQLITE_DB_PATH=local.db` (or copy `backend/.env.example` to `backend/.env`).

OTP note: the backend does **not** include the OTP in the `/api/auth/send-otp` response by default. If SMTP delivery fails, it returns `503` so you fix SMTP and the OTP actually reaches the inbox. For local testing only, you can set `EXPOSE_OTP_IN_RESPONSE=true` to include `otp` in the response payload.

### Email (Real SMTP via Gmail App Password)

To enable real OTP + feedback emails (instead of mock/console delivery):

1. Create a local env file (never commit this):

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

2. Edit `backend/.env` and set:
   - `MOCK_EMAIL_DELIVERY=false`
   - `SMTP_SERVER=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SENDER_EMAIL=<your gmail address>`
   - `SENDER_PASSWORD=<16-char Gmail App Password>` (spaces are OK; the backend strips them)

3. Restart the backend (`cd backend; python run.py`).

Gmail App Password steps (Google Account):
1. Enable 2‑Step Verification on the Gmail account.
2. Open Google Account → Security → "App passwords".
3. Create a new app password for "Mail" (or a custom app name like "Global Supply Chain").
4. Copy the 16‑character app password and paste it into `backend/.env` as `SENDER_PASSWORD`.

Troubleshooting:
- If SMTP fails with `WinError 10013`, your network/firewall is blocking outbound SMTP (ports `587`/`465`). Allow Python through Windows Defender Firewall or try a different network (e.g. mobile hotspot).
- Run `cd backend; python scripts/smtp_check.py --to you@example.com --dry-run` to validate connectivity without sending.
## Full Stack Run Order

1. Start backend first (creates/updates SQLite DB tables automatically):
   - `cd backend`
   - `.venv\Scripts\activate`
   - `python run.py`
2. Verify backend + database:
   - Open `http://localhost:8000/health`
   - Confirm response includes `"status": "ok"` and `"database": "connected"`
3. Start frontend:
   - `cd frontend`
   - `npm run dev`
4. Open frontend URL shown by Vite and login with seeded credentials.

## Auth and User Flows

### Signup with OTP
1. Frontend sends `POST /api/auth/send-otp`
2. User submits OTP via `POST /api/auth/verify-otp`
3. Account is created via `POST /api/auth/signup`

### Login
- `POST /api/auth/login` with `email`, `password`, `role`
- React's login form sends that exact payload with JSON headers so FastAPI's `LoginRequest` signature never sees an invalid shape.

### Guest Flow
- `POST /api/auth/guest-entry` stores guest form details
- Frontend enters guest mode and opens role dashboard in read-only style

The feedback endpoint now stores the submission even if the thank-you email cannot be delivered—its response includes `email_sent: false` and an `email_error` message when SMTP is unreachable, so the UI can still show success while surface delivery issues. During development toggling `MOCK_EMAIL_DELIVERY=true` avoids real SMTP entirely.

## AI + Visual Highlights

- **Working QR Scanner**: The Retail Shop scanner animates the scan with a live radar, builds a blockchain-verified badge, and renders the generated QR image so judges can literally see the product being verified in the demo.
- **Product Journey Timeline**: That same scanner surface now features a dedicated timeline panel that walks through every blockchain stage (with tx hash, timestamp, and AI stage cues) so the entire supply chain is visible on a single screen.
- **Live ETA Countdown**: Timeline entries carry `etaHours`, and the interface maintains a live countdown to the next delivery stage—powered by tracking telemetry and the delay-risk scorer in `tracking/ai-delay-risk`.
- **AI Forecasting & Summaries**: `app/services/ai_service.py` feeds `/admin/ai-forecast`, `/manufacturer/ai-forecast`, `/dealer/ai-reorder-recommendations`, and the blockchain journey summaries; provide either `ANTHROPIC_API_KEY` (Claude) or `GEMINI_API_KEY` (Gemini) to unlock richer forecasts and summaries or let each helper fall back to its built-in mean-based baseline.

## Database

Default DB file:
- `backend/local.db`

Tables created automatically on startup:
- `users`
- `guest_entries`
- `products`
- `batches`
- `orders`
- `shipments`
- `shipment_events`
- `ledger_records`
- `sales_history`
- `notifications`

Signup writes to `users`.
Guest form writes to `guest_entries`.

## Seeded Local Login Credentials

For local testing:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@globalsupply.com |  
| Manufacturer | manufacturer@globalsupply.com | 
| Transporter | transporter@globalsupply.com | 
| Dealer | dealer@globalsupply.com | 
| Retail | retail@globalsupply.com |

## API Modules

- `auth`: login/signup/otp/guest entry
- `admin`: stats, analytics, blockchain monitor, report generation
- `manufacturer`: products, batches, order->batch transition, transporter assignment, AI forecast
- `tracking`: live GPS, map, delay risk, order stage updates
- `dealer`: full order pipeline, trends, inventory, arrivals, AI reorder recommendations
- `blockchain`: tx hash trail, product journey, QR payload endpoint
- `inventory`: retail/dealer/manufacturer inventory snapshot

## Dashboard Function Map

Dashboard pages and the API functions they use:

- `Admin Dashboard` (`frontend/src/pages/Admin/Dashboard.jsx`)
  - `adminApi.stats()`
  - `adminApi.aiForecast(history, periods)`
- `Admin Analytics` (`frontend/src/pages/Admin/Analytics.jsx`)
  - `adminApi.analytics(range)`
- `Admin Blockchain Monitor` (`frontend/src/pages/Admin/BlockchainMonitor.jsx`)
  - `adminApi.blockchainTransactions()`
  - `adminApi.verifyBlockchainTransaction(txHash)`
- `Admin Reports` (`frontend/src/pages/Admin/Systemreport.jsx`)
  - `adminApi.generateReport(payload)`

- `Manufacturer Dashboard` (`frontend/src/pages/Manufacturer/Dashboard.jsx`)
  - `manufacturerApi.aiForecast(history, periods)`
  - `manufacturerApi.batches()`
  - `manufacturerApi.products()`
  - `manufacturerApi.analytics()`

- `Transporter Dashboard` (`frontend/src/pages/Transporter/Dashboard.jsx`)
  - `trackingApi.liveGps()`
  - `trackingApi.analytics(range)`
  - WebSocket stream: `/ws/gps`
- `All dashboards`
  - WebSocket notifications: `/ws/notifications/{userId}`

- `Dealer Dashboard` (`frontend/src/pages/Dealer/Dashboard.jsx`)
  - `dealerApi.recentOrders()`
  - `dealerApi.orderTrends()`
  - `dealerApi.lowStockAlerts()`
  - `dealerApi.arrivals()`
- `Dealer Inventory/Orders/Arrivals/Analytics` pages
  - `dealerApi.inventory()`
  - `dealerApi.arrivals()`
  - `dealerApi.analytics(range)`

- `Retail Dashboard` (`frontend/src/pages/RetailShop/Dashboard.jsx`)
  - `inventoryApi.getInventory()`
- `Retail Sales` (`frontend/src/pages/RetailShop/Sales.jsx`)
  - `inventoryApi.salesAnalytics(range)`

## AI & Live Demo Highlights

### AI-enhanced intelligence
- **Demand forecasting:** `backend/app/services/ai_service.py::predict_demand` calls the configured AI provider (when a key is set) and falls back to a resilient moving-average forecast. The `admin` and `manufacturer` `/ai-forecast` routes expose these insights to the dashboards.
- **Smart reorder hints:** `/dealer/reorder-recommendations` calls `ai_service.predict_low_stock` to annotate every SKU with `priority`/`recommendation` text derived from Claude, so judges can read out high-value suggestions.
- **Delay risk:** `/tracking/ai-delay-risk` uses the same AI service to turn distance + weather + traffic into a normalized delay probability, which feeds the transporter alerts.
- **Enabling AI:** Populate `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` (in `./.env` or your deployment) before demoing; otherwise the API gracefully returns the baseline numbers mentioned above.

### Showcase experiences for judges
1. **Working QR Scanner (`frontend/src/pages/RetailShop/Scanner.jsx`):** Show the quick-scan buttons or enter codes manually, then point a webcam-phone at the booth to highlight the animated scanner, blockchain verification badge, and live QR render. The page calls `/blockchain/qr/{sku}`, `/blockchain/journey/{sku}`, and the new `/blockchain/journey-summary/{sku}` so every scan provides both visual verification and an AI-generated narrative on stage.
2. **Product Journey Timeline:** Once a product is scanned, the same view renders the `journey` trail from the blockchain service, showing every ledger stage as stacked cards with timestamps and TX hashes - this single screen is the "wow moment" that proves traceability end-to-end.
3. **Live ETA Countdown (`frontend/src/pages/Dealer/Arrivals.jsx`):** The dealer arrivals view now keeps a live clock (updates every second) and surfaces a highlighted countdown card next to the selected shipment so you can demo an actionable ETA in real time, even while other data flows in via the GPS socket.

## Notes

- CORS is restricted by default to local Vite origins; set `ALLOWED_ORIGINS`/`CORS_ORIGINS` for deployments (and never use `*` in production).
- In development, OTP value may be returned in API response for easier testing.
- Frontend API layer includes fallbacks for guest mode and unavailable endpoints.
- WebSocket connections are used for live GPS + notifications even if the UI doesn’t show a “WebSocket live” label.
 
