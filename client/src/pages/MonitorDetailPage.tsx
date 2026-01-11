import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Monitor } from '../types';
import { UptimeBar } from '../components/UptimeBar';

export function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMonitor() {
      try {
        const response = await fetch(`/api/monitors/${id}`);
        if (!response.ok) {
          throw new Error('Monitor not found');
        }
        const data = await response.json();
        setMonitor(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load monitor');
      } finally {
        setLoading(false);
      }
    }

    fetchMonitor();
  }, [id]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="container section">
        <Link to="/" className="back-link">← Back to Status</Link>
        <div className="error">{error || 'Monitor not found'}</div>
      </div>
    );
  }

  const getStatusClass = () => {
    if (monitor.currentStatus === 'down') return 'down';
    if (monitor.currentStatus === 'degraded') return 'degraded';
    return '';
  };

  const uptimePercent = monitor.uptime ?? 100;
  const avgResponseTime = monitor.avgResponseTime ?? 0;

  // Generate mock response time data for chart
  const responseTimeData = Array.from({ length: 30 }, () => ({
    value: Math.max(50, avgResponseTime + (Math.random() - 0.5) * 100)
  }));

  const maxResponseTime = Math.max(...responseTimeData.map(d => d.value));

  return (
    <div className="section">
      <div className="container">
        <Link to="/" className="back-link">← Back to Status</Link>
        
        <div className="detail-header">
          <div className="detail-header-top">
            <div className={`detail-indicator ${getStatusClass()}`}></div>
            <h1 className="detail-title">
              {monitor.name} is{' '}
              <span className={getStatusClass()}>
                {monitor.currentStatus === 'up' ? 'Operational' : 
                 monitor.currentStatus === 'degraded' ? 'Degraded' : 'Down'}
              </span>
            </h1>
          </div>
          <p className="detail-subtitle">{monitor.url}</p>
        </div>

        <div className="detail-section">
          <h3 className="section-title">Overall Uptime</h3>
          <div className="detail-uptime-percent" style={{ marginTop: '1rem' }}>
            Last 90 days: {uptimePercent.toFixed(2)}%
          </div>
          <div className="detail-uptime-bar">
            <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
          </div>
        </div>

        <div className="detail-section">
          <h3 className="section-title">Response Time</h3>
          <div className="response-time-chart">
            {responseTimeData.map((data, index) => (
              <div
                key={index}
                className="response-bar"
                style={{
                  height: `${(data.value / maxResponseTime) * 100}%`
                }}
                title={`${data.value.toFixed(0)}ms`}
              />
            ))}
          </div>
          <div className="response-stats">
            <span>Avg: {avgResponseTime.toFixed(0)}ms</span>
            <span>Last 30 days</span>
          </div>
        </div>

        <div className="uptime-stats">
          <div className="uptime-stat">
            <div className="uptime-stat-value">{uptimePercent.toFixed(2)}%</div>
            <div className="uptime-stat-label">Overall Uptime</div>
          </div>
          <div className="uptime-stat">
            <div className="uptime-stat-value">{avgResponseTime.toFixed(0)}ms</div>
            <div className="uptime-stat-label">Avg Response</div>
          </div>
          <div className="uptime-stat">
            <div className="uptime-stat-value">{monitor.interval || 60}s</div>
            <div className="uptime-stat-label">Check Interval</div>
          </div>
          <div className="uptime-stat">
            <div className="uptime-stat-value">{monitor.type.toUpperCase()}</div>
            <div className="uptime-stat-label">Monitor Type</div>
          </div>
        </div>
      </div>
    </div>
  );
}
