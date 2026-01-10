---
name: status-page
description: 
github_repo: https://github.com/simonmcschubert/status-page

status: building

app_id: status-page
server: personal01
server_path: 
license: none
---

# Status Page

A lightweight, self-hosted status page for monitoring services — built from scratch as a learning & portfolio project.

Public status page will be available at `status.simonschubert.com`

## Features

- **Multi-protocol monitoring** - HTTP/HTTPS, TCP, WebSocket, DNS, ICMP (ping)
- **Flexible condition system** - DSL for health checks with JSONPath support
- **Beautiful UI** - Dark mode, responsive design, real-time charts
- **Incident tracking** - Automatic incident creation/resolution with history
- **Maintenance windows** - Scheduled downtime with alert suppression
- **Badges API** - SVG badges for embedding in READMEs
- **Webhook notifications** - Customizable templates via n8n

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
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **Styling**: CSS Variables (dark mode support)
- **Charts**: Recharts (planned)

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

See [plan.md](./plan.md) for detailed configuration options.

### `config/config.yml` - Application Settings

Configure branding, notifications, and UI preferences.

### `config/monitors.yml` - Service Definitions

Define services to monitor with conditions and maintenance windows.

## API Endpoints

- `GET /health` - Health check
- `GET /api/config` - App configuration
- `GET /api/monitors` - Public monitors
- `GET /api/status` - Current status (runs all checks)
- `GET /api/incidents` - Incident history
- `GET /api/monitors/:id/stats` - Monitor statistics
- `POST /api/test-check` - Manual check trigger
- `POST /api/reload-monitors` - Reload configuration

## Project Structure

```
status-page/
├── server/               # Backend application
│   ├── config/          # Configuration loaders and Zod schemas
│   ├── db/              # Database connection and migrations
│   ├── monitors/        # Monitor checkers and condition evaluator
│   │   └── checkers/   # Protocol-specific checkers (HTTP, TCP, WebSocket, DNS, Ping)
│   ├── queue/          # BullMQ job queue setup
│   ├── repositories/   # Data access layer (checks, incidents, history)
│   └── services/       # Business logic (incident detection)
├── client/              # Frontend React application
│   └── src/
│       ├── components/ # MonitorCard, IncidentTimeline
│       ├── pages/      # StatusPage
│       ├── services/   # API client
│       └── styles/     # CSS with theme variables
├── config/              # Configuration files
│   ├── config.yml      # App settings
│   └── monitors.yml    # Monitor definitions
└── docker-compose.yml   # Docker setup
```

## Development Status

🚧 **In Progress** - Active development

### Completed
- ✅ All protocol checkers (HTTP, TCP, WebSocket, DNS, Ping)
- ✅ BullMQ job queue with automated scheduling
- ✅ Database persistence and incident detection
- ✅ React frontend with dark mode
- ✅ Monitor cards and incident timeline

### In Progress
- 🟡 Charts for uptime and response time
- 🟡 Server-Sent Events for real-time updates
- 🟡 Badges API

See [plan.md](./plan.md) for the complete technical design and roadmap.