# CyOps Showcase Competition Hub

Full-stack competition portfolio hub for CyOps submissions. Participants submit an X/Twitter post URL, admins moderate submissions, verified users link both X and Discord, and approved projects can receive one vote per verified user.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, `react-tweet`
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- Auth: JWT session cookie with OAuth flow placeholders for X/Twitter and Discord
- Infra: Docker Compose, Caddy reverse proxy

## Local Setup

1. Copy environment values:

```bash
cp .env.example .env
```

2. Start the full stack:

```bash
docker compose up --build
```

3. Open the site:

```text
http://localhost:8080
```

The backend API is reverse proxied under `/api`.

## Development Without Real OAuth

Use the Login / Verification page to call mock endpoints:

- `POST /api/dev/mock-login`
- `POST /api/dev/mock-link-x`
- `POST /api/dev/mock-link-discord`

To test admin access, set `ADMIN_X_USERNAMES` in `.env`, then mock-link an X username that appears in that comma-separated list.

## Submission Flow

New submissions are created with `pending` status. Public gallery, detail pages, leaderboard, and voting only include `approved` submissions. Admins can approve or reject submissions from `/admin/submissions`.

## Useful Commands

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
```

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Run migrations:

```bash
cd backend
alembic upgrade head
```

## Environment

Key variables are documented in `.env.example`, including OAuth client IDs/secrets, redirect URIs, JWT secret, database URL, CORS origins, and `ADMIN_X_USERNAMES`.

