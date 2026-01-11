import { useEffect, useState } from 'react'
import { MonitorRow } from '../components/MonitorRow'
import IncidentTimeline from '../components/IncidentTimeline'
import { fetchMonitors, fetchIncidents } from '../services/api'
import type { Monitor, Incident } from '../types'

export default function StatusPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [monitorsData, incidentsData] = await Promise.all([
        fetchMonitors(),
        fetchIncidents(),
      ])
      
      setMonitors(monitorsData)
      setIncidents(incidentsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading status...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  const activeIncidents = incidents.filter(i => !i.resolvedAt)
  const hasIssues = activeIncidents.length > 0 || monitors.some(m => m.currentStatus !== 'up')
  const allDown = monitors.length > 0 && monitors.every(m => m.currentStatus === 'down')

  // Calculate overall uptime
  const overallUptime = monitors.length > 0
    ? monitors.reduce((sum, m) => sum + (m.uptime ?? 100), 0) / monitors.length
    : 100

  const getOverallStatusClass = () => {
    if (allDown) return 'down'
    if (hasIssues) return 'degraded'
    return ''
  }

  return (
    <>
      {/* Status Banner */}
      <div className="status-banner">
        <div className="container">
          <div className={`status-indicator ${getOverallStatusClass()}`}></div>
          <div className="status-text">
            <h2>
              All Systems{' '}
              <span className={getOverallStatusClass()}>
                {allDown ? 'Down' : hasIssues ? 'Experiencing Issues' : 'Operational'}
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* Active Incidents */}
      {activeIncidents.length > 0 && (
        <div className="section">
          <div className="container">
            <h2 className="section-title" style={{ marginBottom: '1rem' }}>Active Incidents</h2>
            <IncidentTimeline incidents={activeIncidents} />
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">
              Uptime <span className="section-subtitle">Last 90 days</span>
            </h2>
          </div>

          <div className="monitor-list">
            {monitors.map((monitor) => (
              <MonitorRow key={monitor.id} monitor={monitor} />
            ))}
          </div>

          {/* Overall Stats */}
          <div className="uptime-stats">
            <div className="uptime-stat">
              <div className="uptime-stat-value">{overallUptime.toFixed(2)}%</div>
              <div className="uptime-stat-label">Overall Uptime</div>
            </div>
            <div className="uptime-stat">
              <div className="uptime-stat-value">{monitors.length}</div>
              <div className="uptime-stat-label">Services Monitored</div>
            </div>
            <div className="uptime-stat">
              <div className="uptime-stat-value">
                {monitors.filter(m => m.currentStatus === 'up').length}
              </div>
              <div className="uptime-stat-label">Operational</div>
            </div>
            <div className="uptime-stat">
              <div className="uptime-stat-value">{activeIncidents.length}</div>
              <div className="uptime-stat-label">Active Incidents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Updates / Incident History */}
      <div className="section">
        <div className="container">
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>Status Updates</h2>
          {incidents.length > 0 ? (
            <IncidentTimeline incidents={incidents.slice(0, 5)} />
          ) : (
            <div className="status-updates">
              <p className="status-updates-empty">
                No incidents reported. All systems operating normally.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
