import { Link } from 'react-router-dom';
import type { Monitor } from '../types';
import { UptimeBar } from './UptimeBar';

interface MonitorRowProps {
  monitor: Monitor;
}

export function MonitorRow({ monitor }: MonitorRowProps) {
  const getStatusClass = () => {
    if (monitor.currentStatus === 'down') return 'down';
    if (monitor.currentStatus === 'degraded') return 'degraded';
    return '';
  };

  const uptimePercent = monitor.uptime ?? 100;
  const uptimeClass = uptimePercent < 90 ? 'down' : uptimePercent < 99 ? 'degraded' : '';

  return (
    <Link to={`/monitor/${monitor.id}`} className="monitor-row">
      <div className="monitor-name">
        {monitor.name}
        <span className="arrow">›</span>
      </div>
      
      <div className={`monitor-uptime-percent ${uptimeClass}`}>
        {uptimePercent.toFixed(2)}%
      </div>
      
      <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
      
      <div className={`status-badge ${getStatusClass()}`}>
        <span className="dot"></span>
        {monitor.currentStatus === 'up' ? 'Operational' : 
         monitor.currentStatus === 'degraded' ? 'Degraded' : 'Down'}
      </div>
    </Link>
  );
}
