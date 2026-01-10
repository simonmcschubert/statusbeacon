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

## Architecture

- **Backend**: Node.js + BullMQ + PostgreSQL + Redis
- **Frontend**: Lightweight SPA with dark mode and charts
- **Deployment**: Docker Compose + Nginx reverse proxy
- **Config**: YAML-based with Zod validation

## Project Status

🚧 **Currently in planning phase** - See [plan.md](./plan.md) for detailed technical design.

## Development

Coming soon...

## License

MIT
