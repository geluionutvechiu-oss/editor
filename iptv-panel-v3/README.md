# IPTV Panel v3

Professional IPTV reseller management panel with full Xtream Codes API compatibility.

## Features

- **Client Management** — Full CRUD, bulk actions, CSV export
- **Universal Credentials** — Auto-generates M3U, Xtream Codes, EPG URLs for 11 IPTV apps
- **Xtream Codes API** — Full v1/v2 compatibility (`/player_api.php`, `/get.php`, `/xmltv.php`)
- **Reseller System** — Sub-resellers with credit-based limits
- **Real-time Stats** — Socket.io live server health updates
- **Security Module** — IP firewall, anti-sharing detection, API keys, session manager
- **Invoicing** — PDF invoice generation
- **Background Jobs** — Bull queue for auto-expiry, email notifications, cleanup
- **Audit Logs** — Every action logged with IP + timestamp
- **2FA** — TOTP Google Authenticator compatible

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Development

```bash
# 1. Install all dependencies
npm run install:all

# 2. Configure environment
cp .env.example backend/.env
# Edit backend/.env with your database credentials

# 3. Run database migrations + seed
cd backend
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Start dev servers
cd ..
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Docker

```bash
cp .env.example .env
# Edit .env

docker compose up -d
```

- Panel: http://localhost:5173
- API: http://localhost:3001

## Login Credentials

| Role      | Email                           | Password      |
|-----------|---------------------------------|---------------|
| Admin     | admin@iptv.local                | admin123      |
| Reseller 1| ionescu.mihai@reseller.local    | reseller123   |
| Reseller 2| popescu.elena@reseller.local    | reseller123   |

## Xtream Codes API

Fully compatible with all Xtream Codes apps. Use client credentials:

```
Host:     http://your-server.com:3001
Username: [client username]
Password: [client password]
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/player_api.php?username=X&password=X` | Login / User Info |
| GET | `/player_api.php?...&action=get_live_categories` | Live Categories |
| GET | `/player_api.php?...&action=get_live_streams` | Live Streams |
| GET | `/player_api.php?...&action=get_vod_streams` | VOD |
| GET | `/get.php?username=X&password=X&type=m3u_plus` | M3U Playlist |
| GET | `/xmltv.php?username=X&password=X` | XMLTV EPG |

## Project Structure

```
iptv-panel-v3/
├── backend/
│   ├── src/
│   │   ├── routes/        # Express routes (auth, clients, plans, servers, xtream...)
│   │   ├── middleware/    # JWT auth, IP block, audit log
│   │   ├── services/      # Email, credential generation
│   │   ├── jobs/          # Bull queue: expiry, stats, cleanup
│   │   ├── socket/        # Socket.io real-time events
│   │   └── lib/           # Prisma client, JWT utils, logger
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
├── frontend/
│   └── src/
│       ├── pages/         # One page per module
│       ├── components/    # UI components + layout
│       ├── hooks/         # React Query hooks
│       ├── store/         # Zustand auth store
│       └── lib/           # API client, socket, utils
├── docker-compose.yml
├── .env.example
└── README.md
```

## Environment Variables

See `.env.example` for all required variables.

## Tech Stack

- **Backend**: Node.js 20 + Express + TypeScript + Prisma + PostgreSQL + Redis
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Real-time**: Socket.io
- **Queue**: Bull (Redis-backed)
- **Auth**: JWT (access + refresh tokens) + bcrypt + TOTP 2FA
