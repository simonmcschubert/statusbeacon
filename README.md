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

- **Backend**: Node.js + Express + TypeScript
- **Job Queue**: BullMQ (Redis-backed)
- **Database**: PostgreSQL
- **Config**: YAML with Zod validation
- **Condition Engine**: JSONPath Plus + custom DSL parser

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

6. Start development server:
```bash
npm run dev
```

The server will start at `http://localhost:3000`

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

## Development Status

🚧 **In Progress** - Active development

See [plan.md](./plan.md) for the complete technical design and roadmap.