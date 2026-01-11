export interface Monitor {
  id: number
  name: string
  url: string
  type: 'http' | 'tcp' | 'websocket' | 'dns' | 'ping'
  interval: number
  public: boolean
  currentStatus?: 'up' | 'down' | 'degraded' | 'unknown'
  uptime?: number
  avgResponseTime?: number
  uptimeHistory?: { date: string; uptime: number }[]
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
