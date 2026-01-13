import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, ChevronRight, Wrench } from 'lucide-react';
import type { Monitor } from '../types';
import { UptimeBar } from './UptimeBar';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface MonitorRowProps {
  monitor: Monitor;
}

export function MonitorRow({ monitor }: MonitorRowProps) {
  const uptimePercent = monitor.uptime ?? 100;
  
  const getStatusConfig = () => {
    if (monitor.currentStatus === 'maintenance') {
      return {
        icon: Wrench,
        label: 'Maintenance',
        variant: 'secondary' as const,
        iconClass: 'text-blue-400',
      };
    }
    if (monitor.currentStatus === 'down') {
      return {
        icon: XCircle,
        label: 'Down',
        variant: 'destructive' as const,
        iconClass: 'text-red-400',
      };
    }
    if (monitor.currentStatus === 'degraded') {
      return {
        icon: AlertTriangle,
        label: 'Degraded',
        variant: 'warning' as const,
        iconClass: 'text-yellow-400',
      };
    }
    return {
      icon: CheckCircle,
      label: 'Operational',
      variant: 'success' as const,
      iconClass: 'text-green-400',
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <Link 
      to={`/monitor/${monitor.id}`} 
      className="group block rounded-lg border border-border bg-card p-4 transition-all hover:border-muted-foreground/30 hover:bg-accent/50"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Name and Status Icon */}
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon className={cn("h-5 w-5 shrink-0", status.iconClass)} />
          <div className="min-w-0">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary">
              {monitor.name}
            </h3>
          </div>
        </div>

        {/* Center: Uptime Bar (hidden on small screens) */}
        <div className="hidden md:block flex-1 max-w-md px-4">
          <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
        </div>

        {/* Right: Uptime % and Status Badge */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className={cn(
              "text-lg font-semibold tabular-nums",
              uptimePercent >= 99.9 && "text-green-400",
              uptimePercent >= 99 && uptimePercent < 99.9 && "text-yellow-400",
              uptimePercent < 99 && "text-red-400"
            )}>
              {uptimePercent.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">uptime</div>
          </div>
          
          <Badge variant={status.variant} className="hidden xs:flex">
            {status.label}
          </Badge>
          
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* Mobile: Uptime Bar */}
      <div className="md:hidden mt-3 pt-3 border-t border-border">
        <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
      </div>
    </Link>
  );
}
