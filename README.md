---
name: status-page
description: 
github_repo: https://github.com/simonmcschubert/status-page

status: active

app_id: status-page
server: personal01
server_path: /var/www/status-page
license: none
domain: status.simonschubert.com
---

# Status Page

A lightweight, self-hosted status page for monitoring services — built from scratch as a learning & portfolio project.

**Live Demo**: [status.simonschubert.com](https://status.simonschubert.com)

## Features

- **Multi-protocol monitoring** - HTTP/HTTPS, TCP, WebSocket, DNS, ICMP (ping)
- **Flexible condition system** - DSL for health checks with JSONPath support
- **Beautiful UI** - Dark mode, Tailwind CSS, shadcn/ui components
- **90-day uptime history** - Visual uptime bars with daily aggregation
- **Response time charts** - Real historical response time data
- **Incident tracking** - Automatic incident creation/resolution with history
- **Badges API** - SVG badges for embedding in READMEs
- **Auto-sync monitors** - Monitors defined in YAML, auto-synced to database

## Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express
- **Job Queue**: BullMQ (Redis-backed)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Config**: YAML with Zod validation
- **Condition Engine**: JSONPath Plus + custom DSL parser

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: React Router
- **Icons**: Lucide React

### Infrastructure
- **Deployment**: Ansible playbooks
- **Web Server**: Nginx with SSL (Let's Encrypt)
- **Process Manager**: systemd

## Getting Started

### Prerequisites

- Node.js >= 20.4
- PostgreSQL 16
- Redis 7

### Installation

1. Clone the repository:
```bash
git clone https://github.com/simonmcschubert/status-page.git
cd status-page
```

2. Install dependencies:
```bash
npm install
cd client && npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Set up configuration files:
```bash
cp config/config.example.yml config/config.yml
cp config/monitors.example.yml config/monitors.yml
# Edit config files as needed
```

5. Run database migrations:
```bash
npm run db:migrate
```

6. Start development servers:
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

### Using Docker

```bash
docker-compose up -d
```

## Configuration

### `config/config.yml` - Application Settings

Configure branding, notifications, and UI preferences.

### `config/monitors.yml` - Service Definitions

```yaml
monitors:
  - id: 1
    name: My Website
    group: "Core Services"
    url: https://example.com/
    type: http
    interval: 60
    public: true
    conditions:
      - "[STATUS] == 200"
      - "[RESPONSE_TIME] < 500"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/config` | GET | App configuration |
| `/api/monitors` | GET | All public monitors with stats |
| `/api/monitors/:id` | GET | Single monitor with response time history |
| `/api/status` | GET | Current status (runs all checks) |
| `/api/incidents` | GET | Incident history |
| `/api/test-check` | POST | Manual check trigger |
| `/api/reload-monitors` | POST | Reload configuration |

## Project Structure

```
status-page/
├── server/               # Backend application
│   ├── config/          # Configuration loaders and Zod schemas
│   ├── db/              # Database connection and migrations
│   ├── jobs/            # Scheduled jobs (daily aggregation)
│   ├── monitors/        # Monitor checkers and condition evaluator
│   │   └── checkers/   # Protocol-specific checkers
│   ├── queue/          # BullMQ job queue setup
│   ├── repositories/   # Data access layer
│   └── index.ts        # Express server
├── client/              # Frontend React application
│   └── src/
│       ├── components/ # UI components
│       │   └── ui/    # shadcn/ui components
│       ├── pages/      # StatusPage, MonitorDetailPage
│       ├── services/   # API client
│       └── lib/        # Utilities
├── config/              # Configuration files
├── scripts/             # Deployment scripts
└── ansible/             # Ansible playbooks
```

## Deployment

Deploy to production using the included script:

```bash
./scripts/deploy.sh
```

This runs Ansible playbooks that:
- Clone/update the repository
- Install dependencies
- Build frontend and backend
- Run database migrations
- Configure Nginx with SSL
- Restart the systemd service

## Development Status

✅ **Production Ready** - Actively monitoring services

### Completed
- ✅ All protocol checkers (HTTP, TCP, WebSocket, DNS, Ping)
- ✅ BullMQ job queue with automated scheduling
- ✅ Database persistence and incident detection
- ✅ React frontend with Tailwind CSS + shadcn/ui
- ✅ 90-day uptime visualization
- ✅ Response time charts with real data
- ✅ Daily historical data aggregation
- ✅ Monitor detail pages
- ✅ Ansible deployment

### Planned
- 🟡 Server-Sent Events for real-time updates
- 🟡 Email/webhook notifications
- 🟡 Scheduled maintenance windows
- 🟡 Public badges API

## License

Private project - not licensed for redistribution.