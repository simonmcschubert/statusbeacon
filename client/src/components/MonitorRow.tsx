import { memo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, ChevronRight, Wrench } from 'lucide-react';
import type { Monitor } from '../types';
import { UptimeBar } from './UptimeBar';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface MonitorRowProps {
  monitor: Monitor;
}

export const MonitorRow = memo(function MonitorRow({ monitor }: MonitorRowProps) {
  const uptimePercent = monitor.uptime ?? 100;

  const getStatusConfig = () => {
    if (monitor.currentStatus === 'maintenance') {
      return {
        icon: Wrench,
        label: 'Maintenance',
        variant: 'secondary' as const,
        iconClass: 'text-maintenance',
      };
    }
    if (monitor.currentStatus === 'down') {
      return {
        icon: XCircle,
        label: 'Down',
        variant: 'destructive' as const,
        iconClass: 'text-error',
      };
    }
    if (monitor.currentStatus === 'degraded') {
      return {
        icon: AlertTriangle,
        label: 'Degraded',
        variant: 'warning' as const,
        iconClass: 'text-warning',
      };
    }
    return {
      icon: CheckCircle,
      label: 'Operational',
      variant: 'success' as const,
      iconClass: 'text-success',
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <Link
      to={`/monitor/${monitor.id}`}
      className="group block py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors -mx-4 px-4 rounded-md"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Name and Status Icon */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StatusIcon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", status.iconClass)} />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium font-serif text-base sm:text-lg text-foreground group-hover:text-primary transition-colors truncate">
              {monitor.name}
            </h3>
          </div>
        </div>

        {/* Center: Uptime Bar (hidden on small screens) */}
        <div className="hidden md:block flex-1 max-w-sm px-4 opacity-70 group-hover:opacity-100 transition-opacity">
          <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
        </div>

        {/* Right: Uptime % and Status Badge */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className={cn(
              "text-base sm:text-lg font-bold font-serif tabular-nums",
              uptimePercent >= 99.9 && "text-success",
              uptimePercent >= 99 && uptimePercent < 99.9 && "text-warning",
              uptimePercent < 99 && "text-error"
            )}>
              {uptimePercent.toFixed(2)}%
            </div>
          </div>

          <Badge variant={status.variant} className="hidden xs:flex font-sans">
            {status.label}
          </Badge>

          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* Mobile: Uptime Bar */}
      <div className="md:hidden mt-3 opacity-80 pl-8">
        <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
      </div>
    </Link>
  );
});
