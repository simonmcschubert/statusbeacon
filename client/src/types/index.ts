export interface MaintenanceWindow {
  startTime: string
  endTime: string
  description?: string
}

export interface ActiveMaintenance {
  active: boolean
  description?: string
  endsAt?: string
}

export interface Monitor {
  id: number
  name: string
  url: string
  type: 'http' | 'tcp' | 'websocket' | 'dns' | 'ping'
  interval: number
  public: boolean
  group?: string
  currentStatus?: 'up' | 'down' | 'degraded' | 'unknown' | 'maintenance'
  uptime?: number
  avgResponseTime?: number | string
  uptimeHistory?: { date: string; uptime: number }[]
  responseTimeHistory?: { timestamp: string; avgResponseTime: number; minResponseTime: number; maxResponseTime: number }[]
  recentChecks?: { timestamp: string; responseTime: number; success: boolean }[]
  incidents?: Incident[]
  maintenance?: ActiveMaintenance
  upcomingMaintenance?: MaintenanceWindow[]
}

export interface Incident {
  id: number
  monitorId: number
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  severity: 'minor' | 'major' | 'critical'
  title: string
  description?: string
  startedAt: string
  resolvedAt?: string
}

export interface CheckResult {
  monitorId: number
  monitorName: string
  success: boolean
  responseTime: number
  timestamp: string
  error?: string
}
