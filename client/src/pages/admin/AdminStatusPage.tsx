import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Activity, Server, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { UptimeBar } from '../../components/UptimeBar';
import { Badge } from '../../components/ui/badge';
import IncidentTimeline from '../../components/IncidentTimeline';
import { useSmartPolling } from '../../hooks/useSmartPolling';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import type { Monitor, Incident } from '../../types';

export function AdminStatusPage() {
  const { accessToken } = useAuth();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const [statusResponse, incidentsResponse] = await Promise.all([
        fetch('/api/admin/status', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch('/api/admin/incidents', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
      ]);
      
      if (!statusResponse.ok) {
        const text = await statusResponse.text();
        let errorMessage = 'Failed to fetch status';
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = statusResponse.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const statusData = await statusResponse.json();
      const incidentsData = incidentsResponse.ok ? await incidentsResponse.json() : { incidents: [] };
      
      setMonitors(statusData.monitors || []);
      setIncidents(incidentsData.incidents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Smart polling: 10s when active, 60s when tab hidden
  useSmartPolling({
    onPoll: loadData,
    activeInterval: 10000,
    inactiveInterval: 60000,
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg flex items-center gap-2">
        <XCircle className="h-5 w-5" />
        <span>Error: {error}</span>
      </div>
    );
  }

  const privateMonitors = monitors.filter(m => !m.public);
  const hasIssues = monitors.some(m => m.currentStatus !== 'up');
  const allDown = monitors.length > 0 && monitors.every(m => m.currentStatus === 'down');

  // Calculate overall uptime
  const overallUptime = monitors.length > 0
    ? monitors.reduce((sum, m) => sum + (m.uptime ?? 100), 0) / monitors.length
    : 100;

  const getStatusIcon = () => {
    if (allDown) return <XCircle className="h-8 w-8" />;
    if (hasIssues) return <AlertTriangle className="h-8 w-8" />;
    return <CheckCircle className="h-8 w-8" />;
  };

  const getStatusText = () => {
    if (allDown) return 'All Systems Down';
    if (hasIssues) return 'Some Systems Experiencing Issues';
    return 'All Systems Operational';
  };

  return (
    <div className="space-y-8">
      {/* Status Banner */}
      <div className={cn(
        "p-6 rounded-lg",
        allDown && "bg-error/20 border border-error/30",
        hasIssues && !allDown && "bg-warning/20 border border-warning/30",
        !hasIssues && "bg-success/20 border border-success/30"
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-full",
            allDown && "bg-error/30 text-error",
            hasIssues && !allDown && "bg-warning/30 text-warning",
            !hasIssues && "bg-success/30 text-success"
          )}>
            {getStatusIcon()}
          </div>
          <div>
            <h2 className={cn(
              "text-xl font-bold",
              allDown && "text-error",
              hasIssues && !allDown && "text-warning",
              !hasIssues && "text-success"
            )}>
              {getStatusText()}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <div className={cn(
              "text-2xl font-bold",
              (overallUptime ?? 100) >= 99.9 ? "text-success" :
              (overallUptime ?? 100) >= 99 ? "text-warning" : "text-error"
            )}>
              {(overallUptime ?? 100).toFixed(2)}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Overall Uptime</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              {monitors.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Total Services</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-success flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {monitors.filter(m => m.currentStatus === 'up').length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Operational</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-muted-foreground flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              {privateMonitors.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Private</div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Uptime
            </h2>
            <span className="text-sm text-muted-foreground">Last 90 days</span>
          </div>
        </div>

        <div className="space-y-3">
          {monitors.map((monitor) => (
            <AdminMonitorRow key={monitor.id} monitor={monitor} />
          ))}
          {monitors.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No monitors configured yet. Go to{' '}
              <Link to="/admin/monitors" className="text-info hover:underline">
                Monitors
              </Link>
              {' '}to add your first monitor.
            </div>
          )}
        </div>
      </section>

      {/* Status Updates / Incident History */}
      <section>
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Status Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length > 0 ? (
              <IncidentTimeline incidents={incidents.slice(0, 5)} />
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-5 w-5 mr-2 text-success" />
                <span>No incidents reported. All systems operating normally.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// Monitor row - clickable to view details
function AdminMonitorRow({ monitor }: { monitor: Monitor }) {
  const uptimePercent = monitor.uptime ?? 100;
  
  const getStatusConfig = () => {
    if (monitor.currentStatus === 'maintenance') {
      return {
        icon: AlertTriangle,
        label: 'Maintenance',
        iconClass: 'text-maintenance',
        badgeClass: 'bg-maintenance/20 text-maintenance',
      };
    }
    if (monitor.currentStatus === 'down') {
      return {
        icon: XCircle,
        label: 'Down',
        iconClass: 'text-error',
        badgeClass: 'bg-error/20 text-error',
      };
    }
    if (monitor.currentStatus === 'degraded') {
      return {
        icon: AlertTriangle,
        label: 'Degraded',
        iconClass: 'text-warning',
        badgeClass: 'bg-warning/20 text-warning',
      };
    }
    return {
      icon: CheckCircle,
      label: 'Operational',
      iconClass: 'text-success',
      badgeClass: 'bg-success/20 text-success',
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <Link 
      to={`/admin/status/${monitor.id}`}
      className="group block rounded-lg border border-border bg-card p-4 transition-all hover:border-muted-foreground/50 hover:bg-card/80"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Name and Status Icon */}
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon className={cn("h-5 w-5 shrink-0", status.iconClass)} />
          <div className="min-w-0 flex items-center gap-2">
            <h3 className="font-medium text-foreground truncate">
              {monitor.name}
            </h3>
            {!monitor.public && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
            {monitor.group && (
              <span className="px-2 py-0.5 bg-muted text-foreground/80 rounded text-xs">
                {monitor.group}
              </span>
            )}
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
              (uptimePercent ?? 100) >= 99.9 && "text-success",
              (uptimePercent ?? 100) >= 99 && (uptimePercent ?? 100) < 99.9 && "text-warning",
              (uptimePercent ?? 100) < 99 && "text-error"
            )}>
              {(uptimePercent ?? 100).toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">uptime</div>
          </div>
          
          <Badge className={cn("hidden xs:flex", status.badgeClass)}>
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Mobile: Uptime Bar */}
      <div className="md:hidden mt-3 pt-3 border-t border-border">
        <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
      </div>
    </Link>
  );
}
