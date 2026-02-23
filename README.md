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
- Database: SQLite (default), MySQL URL config placeholder
- Auth: JWT bearer tokens + OTP email verification
- Realtime: WebSocket GPS feed (`/ws/gps`)

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
- `SQLITE_DB_PATH` (default: `data/app.db`)
- `MOCK_EMAIL_DELIVERY` (default: `true` in development)
- `SMTP_SERVER`, `SMTP_PORT`, `SENDER_EMAIL`, `SENDER_PASSWORD`, `SENDER_NAME`

### Frontend (optional)

- `VITE_API_BASE_URL` (default: `/api`)
- `VITE_GPS_SOCKET_URL` (default: browser host + `/ws/gps`)
- `VITE_DEV_PROXY_TARGET` (default in Vite config: `http://localhost:8000`)

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
- `manufacturer`: products, batches, AI forecast
- `tracking`: live GPS, map, delay risk
- `dealer`: orders, trends, inventory, arrivals, analytics
- `inventory`: retail/dealer/manufacturer inventory snapshot

## Notes

- CORS is open for local development.
- In development, OTP value may be returned in API response for easier testing.
- Frontend API layer includes fallbacks for guest mode and unavailable endpoints.
