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
- Database: SQLite (default) or PostgreSQL via `DATABASE_URL` (Render-ready)
- Auth: JWT bearer tokens + OTP email verification
- Realtime: WebSocket GPS feed (`/ws/gps`) + notifications (`/ws/notifications/{userId}`)

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

Backend runs on: `http://localhost:8000`

Useful endpoints:
- Health: `GET /health`
- OpenAPI docs: `GET /docs`
- Health should return database info (`database: connected`) when DB is reachable.

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

## Environment Variables

### Backend (optional)

- `APP_ENV` (default: `development`)
- `SECRET_KEY`
- `JWT_ALGORITHM` (default: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: `60`)
- `DATABASE_URL` (preferred in production, e.g. Render PostgreSQL URL)
- `SQLITE_DB_PATH` (default: `data/app.db`)
- `BLOCKCHAIN_SALT` (hash salt for ledger signatures)
- `GEMINI_API_KEY` (for AI integrations)
- `MOCK_EMAIL_DELIVERY` (default: `true` in development)
- `SMTP_SERVER`, `SMTP_PORT`, `SENDER_EMAIL`, `SENDER_PASSWORD`, `SENDER_NAME`

### Frontend (optional)

- `VITE_API_BASE_URL` (default: `/api`)
- `VITE_GPS_SOCKET_URL` (default: browser host + `/ws/gps`)
- `VITE_DEV_PROXY_TARGET` (default in Vite config: `http://localhost:8000`)

### Secrets and `.env`

- Put sensitive keys in `.env` (example: `GEMINI_API_KEY=...`).
- `.env` is ignored by git (`.gitignore` includes `.env` and `.env.*`).
- Use `.env.example` files for safe placeholders only.

### Render PostgreSQL Setup

1. Create a free PostgreSQL service in Render.
2. Copy the internal/external database URL from Render.
3. Set backend environment variable `DATABASE_URL` to that URL.
4. Keep `SQLITE_DB_PATH` only as local fallback.
5. Restart the backend service. On startup, tables are auto-created via SQLAlchemy.

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

### Guest Flow
- `POST /api/auth/guest-entry` stores guest form details
- Frontend enters guest mode and opens role dashboard in read-only style

## Database

Default DB file:
- `backend/data/app.db`

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
| Admin | admin@globalsupply.com | admin123 |
| Manufacturer | manufacturer@globalsupply.com | maker123 |
| Transporter | transporter@globalsupply.com | transport123 |
| Dealer | dealer@globalsupply.com | dealer123 |
| Retail | retail@globalsupply.com | retail123 |

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

## Notes

- CORS is open for local development.
- In development, OTP value may be returned in API response for easier testing.
- Frontend API layer includes fallbacks for guest mode and unavailable endpoints.
