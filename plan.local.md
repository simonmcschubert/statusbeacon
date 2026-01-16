# Status Page - Open Features & Roadmap

This document tracks features that are not yet implemented or partially complete.

---

## 🟡 In Progress

(None currently)

---

## ❌ Not Yet Implemented

### Notifications
- [ ] Webhook notifications to n8n
- [ ] Template placeholders (`[MONITOR_NAME]`, `[STATUS]`, `[RESPONSE_TIME]`, `[ERROR]`, `[TIMESTAMP]`, `[INCIDENT_ID]`)
- [ ] Rate limiting / cooldown between notifications
- [ ] Notification on incident open/close

### Badges API
- [ ] `GET /badge/{monitor}/uptime/{duration}.svg` - Uptime badge (7d, 30d, 90d)
- [ ] `GET /badge/{monitor}/status.svg` - Current status badge
- [ ] `GET /badge/{monitor}/response-time.svg` - Avg response time badge

### Advanced Features
- [ ] Flapping detection (5+ transitions in 10min → mark as degraded)
- [ ] Status page subscriptions (email notifications)
- [ ] Custom incident announcements (manual announcements)
- [ ] Data retention policy (cleanup old checks)

---

## 🚀 Future Enhancements (v2)

- [ ] Multi-location probes (check from multiple regions)
- [ ] Custom alert thresholds per service
- [ ] gRPC protocol support
- [ ] Public API for external integrations

---

## 📝 Notes

### Notification Template Placeholders
```
[MONITOR_NAME] - Name of the monitor
[STATUS] - Current status (up/down/degraded)
[RESPONSE_TIME] - Response time in ms
[ERROR] - Error message if check failed
[TIMESTAMP] - ISO timestamp of the event
[INCIDENT_ID] - Unique incident identifier
```

### Notification Flow (Planned)
```
Backend → Webhook → n8n → Email/Slack/etc.
```
Keeps notification logic configurable without code changes.

### Badge API (Planned)
SVG badges for embedding in READMEs:
```markdown
![Uptime](https://status.example.com/badge/my-service/uptime/7d.svg)
![Status](https://status.example.com/badge/my-service/status.svg)
```
