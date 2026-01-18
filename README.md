<div align="center">

# 📊 StatusBeacon

A lightweight, self-hosted status page for monitoring your services.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Live Demo](https://status.simonschubert.com) · [Report Bug](https://github.com/simonmcschubert/statusbeacon/issues)

</div>

---

## ✨ Features

- 🔍 **Multi-protocol monitoring** — HTTP/HTTPS, TCP, WebSocket, DNS, ICMP (ping)
- 📝 **Flexible conditions** — DSL for health checks with JSONPath support
- 🔐 **SSL certificate monitoring** — Alert before certificates expire
- 🎨 **Beautiful UI** — Dark mode, responsive design with Tailwind CSS
- 📈 **90-day uptime history** — Visual uptime bars with daily aggregation
- ⏱️ **Response time charts** — Historical performance data
- 🚨 **Incident tracking** — Automatic incident creation and resolution
- 🛡️ **False positive prevention** — 2/3 failures required before marking down
- 🔒 **Private monitors** — Keep internal services hidden from public view
- 🛠️ **YAML configuration** — Define monitors as code, version control friendly
- 🔑 **Admin dashboard** — JWT-authenticated admin UI for monitoring
- 🕐 **Maintenance windows** — Schedule downtime, suppress alerts
- ⚡ **Smart polling** — Visibility-aware refresh (10s active, 60s background)
- � **Hot reload** — Update config without restarting the server
- �🐳 **Docker support** — Easy deployment with Docker Compose

## 🖼️ Screenshots

<details>
<summary>View screenshots</summary>

| Public Status Page | Admin Dashboard |
|:------------------:|:---------------:|
| ![Public Page](docs/screenshots/public.png) | ![Admin](docs/screenshots/admin.png) |

</details>

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/simonmcschubert/statusbeacon.git
cd statusbeacon

# Copy example configuration
cp .env.example .env
cp config/config.example.yml config/config.yml
cp config/monitors.example.yml config/monitors.yml

# Start with Docker Compose
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) to view your status page.

### Manual Installation

<details>
<summary>Click to expand</summary>

#### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Node.js](https://nodejs.org/) | 20+ | Runtime |
| [PostgreSQL](https://www.postgresql.org/) | 16+ | Database |
| [Redis](https://redis.io/) | 7+ | Job queue |
| [yq](https://github.com/mikefarah/yq) | 4+ | Deploy script (optional) |

#### Steps

```bash
# Clone and install
git clone https://github.com/simonmcschubert/statusbeacon.git
cd statusbeacon
npm install
cd client && npm install && cd ..

# Configure
cp .env.example .env
cp config/config.example.yml config/config.yml
cp config/monitors.example.yml config/monitors.yml

# Edit .env with your database credentials
# Edit config files as needed

# Start development servers
npm run dev          # Backend on :3000
cd client && npm run dev  # Frontend on :5173
```

</details>

## ⚙️ Configuration

StatusBeacon uses a **hybrid configuration** approach:
- **config.yml** — Infrastructure settings, can include database/redis URLs
- **.env** — Secrets only (JWT_SECRET, ADMIN_PASSWORD)

### Configuration File (`config.yml`)

```yaml
# Application settings
app:
  title: "My Status Page"
  description: "Service status for my infrastructure"
  timezone: "UTC"

# Infrastructure (alternative to .env)
server:
  port: 3000
  node_env: production

database:
  url: postgresql://user:pass@localhost:5432/statuspage

redis:
  url: redis://localhost:6379

admin:
  email: admin@example.com  # Password comes from .env

# Notifications
notifications:
  webhook_url: https://your-webhook.com/alerts
  cooldown: 300
  template: |
    {"service": "[MONITOR_NAME]", "status": "[STATUS]"}
```

### Environment Variables (`.env`)

Only secrets need to be in `.env`:

```bash
# Required secrets
JWT_SECRET=your-secret-key  # Generate with: openssl rand -base64 32
ADMIN_PASSWORD=secure_password  # Only needed on first run

# Optional: Override config.yml settings
# DATABASE_URL=postgresql://...
# REDIS_URL=redis://...
# PORT=3000

# External config paths (for separate config deployment)
# CONFIG_PATH=/var/data/statusbeacon/config.yml
# MONITORS_PATH=/var/data/statusbeacon/monitors.yml

# Disable hot reload if needed (default: enabled)
# WATCH_CONFIG=false
```

### Monitor Configuration (`monitors.yml`)

```yaml
monitors:
  - id: 1
    name: My Website
    group: "Core Services"
    url: https://example.com/
    type: http
    interval: 60          # Check every 60 seconds
    public: true          # Show on public status page
    conditions:
      - "[STATUS] == 200"
      - "[RESPONSE_TIME] < 500"
      - "[CERTIFICATE_EXPIRATION] > 7d"

  - id: 2
    name: Internal API
    url: http://internal-api:8080/health
    type: http
    interval: 30
    public: false         # Hidden from public, visible in admin
    conditions:
      - "[STATUS] == 200"
      - "[BODY].status == 'ok'"
```

### Supported Monitor Types

| Type | Description | Example URL |
|------|-------------|-------------|
| `http` | HTTP/HTTPS endpoints | `https://api.example.com/health` |
| `tcp` | TCP port checks | `tcp://db.example.com:5432` |
| `websocket` | WebSocket connections | `wss://ws.example.com` |
| `dns` | DNS resolution | `dns://example.com` |
| `ping` | ICMP ping | `ping://server.example.com` |

### Condition DSL

```yaml
conditions:
  # Status codes
  - "[STATUS] == 200"
  - "[STATUS] >= 200 && [STATUS] < 300"
  
  # Response time (ms)
  - "[RESPONSE_TIME] < 500"
  
  # SSL certificate expiration
  - "[CERTIFICATE_EXPIRATION] > 30d"
  
  # JSON body (with JSONPath)
  - "[BODY].status == 'healthy'"
  - "[BODY].services[0].name == 'api'"
```

## 🔌 API

### Public Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/monitors` | All public monitors with uptime stats |
| `GET /api/monitors/:id` | Single monitor with response time history |
| `GET /api/status` | Current status of all public monitors |
| `GET /api/incidents` | Incident history |
| `GET /api/config` | App configuration (branding, etc.) |

### Admin Endpoints

All admin endpoints require JWT authentication.

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Authenticate and get tokens |
| `GET /api/admin/status` | All monitors including private ones |
| `GET /api/admin/monitors/:id/details` | Detailed monitor stats |
| `POST /api/reload-monitors` | Reload configuration from YAML |

## 🔄 Hot Reload

StatusBeacon uses [chokidar](https://github.com/paulmillr/chokidar) to watch your config files and automatically reload without downtime:

```bash
# Edit your config
vim /var/data/statusbeacon/monitors.yml

# Changes are applied automatically!
# Check the logs to confirm:
# "🔄 Config file changed: /var/data/statusbeacon/monitors.yml"
# "  ✓ Config validation passed"
# "✅ Config reloaded successfully"
```

**Features:**
- Validates config before applying (keeps old config if validation fails)
- Debounces rapid file changes
- Works with both local and external config paths
- Cross-platform compatible

This enables a clean separation between app code and configuration:
- Deploy the app from a public repository
- Manage config files separately (private repo or manual deployment)
- Update monitors without restarting the service

To disable hot reload, set `WATCH_CONFIG=false` in your environment.

## 🏗️ Tech Stack

<table>
<tr>
<td valign="top">

### Backend
- **Node.js** + **TypeScript**
- **Express** — HTTP server
- **BullMQ** — Job queue (Redis)
- **PostgreSQL** — Data persistence
- **Zod** — Schema validation

</td>
<td valign="top">

### Frontend
- **React 19** + **TypeScript**
- **Vite 7** — Build tool
- **Tailwind CSS** — Styling
- **shadcn/ui** — Components
- **Recharts** — Charts

</td>
</tr>
</table>

## 📁 Project Structure

```
statusbeacon/
├── server/                 # Backend
│   ├── config/            # Config loaders, schemas & file watcher
│   ├── db/                # Database & migrations
│   ├── monitors/          # Protocol checkers
│   ├── queue/             # BullMQ job processing
│   └── repositories/      # Data access layer
├── client/                 # Frontend
│   └── src/
│       ├── components/    # React components
│       ├── pages/         # Route pages
│       └── services/      # API client
├── config/                 # YAML configuration (examples only)
│   ├── config.example.yml # App settings template
│   └── monitors.example.yml # Monitor definitions template
└── scripts/
    ├── dev.sh             # Development with external config support
    ├── deploy.example.sh  # Deployment template
    └── update-config.example.sh # Config sync template
```

## 🚢 Deployment

### Recommended: Private Config Folder

Keep your deploy script and config files in a private folder, separate from the app code:

```
~/private-configs/statusbeacon/
├── deploy.sh          # Full deploy (copy from scripts/deploy.example.sh)
├── update-config.sh   # Config-only updates (hot reload, no restart)
├── config.yml         # Your app config
├── monitors.yml       # Your monitors
└── .env               # Secrets (JWT_SECRET, ADMIN_PASSWORD)
```

**Deploy workflow:**
```bash
cd ~/private-configs/statusbeacon

# Full deploy (app + config)
./deploy.sh

# Quick config update (no restart needed - hot reload!)
./update-config.sh
```

### Development

```bash
# Using local config folder
./scripts/dev.sh

# Using external config folder
./scripts/dev.sh ~/private-configs/statusbeacon
```

The dev script sets `CONFIG_PATH` and `MONITORS_PATH` automatically.

### Production Requirements

- **Nginx** — Reverse proxy with SSL
- **systemd** — Process management
- **Let's Encrypt** — SSL certificates
- **PostgreSQL 16+** — Database
- **Redis 7+** — Job queue

See [deployment documentation](docs/deployment.md) for detailed setup instructions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful components
- [Tailwind CSS](https://tailwindcss.com/) for the styling system
- [BullMQ](https://docs.bullmq.io/) for reliable job processing