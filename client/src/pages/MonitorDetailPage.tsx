import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, CheckCircle, XCircle, AlertTriangle, Bell, AlertCircle, Wrench } from 'lucide-react';
import type { Monitor } from '../types';
import { UptimeBar } from '../components/UptimeBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Status
          </Link>
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>{error || 'Monitor not found'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusVariant = (): 'success' | 'destructive' | 'warning' | 'secondary' => {
    if (monitor.currentStatus === 'maintenance') return 'secondary';
    if (monitor.currentStatus === 'down') return 'destructive';
    if (monitor.currentStatus === 'degraded') return 'warning';
    return 'success';
  };

  const getStatusIcon = () => {
    if (monitor.currentStatus === 'maintenance') return <Wrench className="h-5 w-5" />;
    if (monitor.currentStatus === 'down') return <XCircle className="h-5 w-5" />;
    if (monitor.currentStatus === 'degraded') return <AlertTriangle className="h-5 w-5" />;
    return <CheckCircle className="h-5 w-5" />;
  };

  const getStatusText = () => {
    if (monitor.currentStatus === 'maintenance') return 'Maintenance';
    if (monitor.currentStatus === 'down') return 'Down';
    if (monitor.currentStatus === 'degraded') return 'Degraded';
    return 'Operational';
  };

  const uptimePercent = monitor.uptime ?? 100;
  const avgResponseTime = typeof monitor.avgResponseTime === 'string' 
    ? parseFloat(monitor.avgResponseTime) 
    : (monitor.avgResponseTime ?? 0);

  // Use 90-day aggregated history for the chart (prefer daily data over individual checks)
  const responseTimeData = monitor.responseTimeHistory && monitor.responseTimeHistory.length > 0
    ? monitor.responseTimeHistory.map(h => ({
        value: h.avgResponseTime,
        timestamp: h.timestamp,
        success: true,
        minValue: h.minResponseTime,
        maxValue: h.maxResponseTime,
      }))
    : monitor.recentChecks && monitor.recentChecks.length > 0
    ? monitor.recentChecks.slice(-90).map(check => ({
        value: check.responseTime,
        timestamp: check.timestamp,
        success: check.success,
        minValue: check.responseTime,
        maxValue: check.responseTime,
      }))
    : [];

  const maxResponseTime = responseTimeData.length > 0 
    ? Math.max(...responseTimeData.map(d => d.value), 1)
    : 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Status
        </Link>

        {/* Maintenance Banner */}
        {monitor.maintenance?.active && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="font-medium text-foreground">Scheduled Maintenance in Progress</p>
                  {monitor.maintenance.description && (
                    <p className="text-sm text-muted-foreground mt-1">{monitor.maintenance.description}</p>
                  )}
                  {monitor.maintenance.endsAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected to end: {new Date(monitor.maintenance.endsAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full",
                    monitor.currentStatus === 'up' && "bg-success/10 text-success",
                    monitor.currentStatus === 'degraded' && "bg-warning/10 text-warning",
                    monitor.currentStatus === 'down' && "bg-destructive/10 text-destructive",
                    monitor.currentStatus === 'maintenance' && "bg-blue-500/10 text-blue-400"
                  )}>
                    {getStatusIcon()}
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">
                      {monitor.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">{monitor.url}</p>
                  </div>
                </div>
              </div>
              <Badge variant={getStatusVariant()} className="text-sm px-3 py-1">
                {getStatusText()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Uptime Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Overall Uptime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last 90 days</span>
              <span className={cn(
                "text-2xl font-bold",
                uptimePercent >= 99.9 ? "text-success" :
                uptimePercent >= 99 ? "text-warning" : "text-destructive"
              )}>
                {uptimePercent.toFixed(2)}%
              </span>
            </div>
            <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
          </CardContent>
        </Card>

        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {responseTimeData.length > 0 ? (
              <>
                <div className="flex items-end gap-[2px] h-24 mb-4">
                  {responseTimeData.map((data, index) => {
                    const date = new Date(data.timestamp);
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const tooltipText = data.minValue !== data.maxValue
                      ? `${dateStr}: Avg ${data.value.toFixed(0)}ms (${data.minValue}-${data.maxValue}ms)`
                      : `${dateStr}: ${data.value.toFixed(0)}ms`;
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex-1 rounded-t transition-colors cursor-default min-w-[2px]",
                          data.success 
                            ? "bg-primary/60 hover:bg-primary" 
                            : "bg-destructive/60 hover:bg-destructive"
                        )}
                        style={{
                          height: `${Math.max((data.value / maxResponseTime) * 100, 5)}%`
                        }}
                        title={tooltipText}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Avg: {avgResponseTime.toFixed(0)}ms</span>
                  <span>Last {responseTimeData.length} days</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground">
                No response time data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className={cn(
                "text-2xl font-bold",
                uptimePercent >= 99.9 ? "text-success" :
                uptimePercent >= 99 ? "text-warning" : "text-destructive"
              )}>
                {uptimePercent.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Overall Uptime</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-foreground">
                {avgResponseTime.toFixed(0)}ms
              </div>
              <div className="text-sm text-muted-foreground mt-1">Avg Response</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-foreground">
                {monitor.interval || 60}s
              </div>
              <div className="text-sm text-muted-foreground mt-1">Check Interval</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-foreground uppercase">
                {monitor.type}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Monitor Type</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Updates / Incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              Status Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monitor.incidents && monitor.incidents.length > 0 ? (
              <div className="space-y-4">
                {monitor.incidents.map((incident) => {
                  const startDate = new Date(incident.startedAt);
                  const resolvedDate = incident.resolvedAt ? new Date(incident.resolvedAt) : null;
                  const isResolved = incident.status === 'resolved';
                  
                  const getSeverityVariant = (): 'success' | 'warning' | 'destructive' => {
                    if (isResolved) return 'success';
                    if (incident.severity === 'critical') return 'destructive';
                    if (incident.severity === 'major') return 'destructive';
                    return 'warning';
                  };
                  
                  const getStatusIcon = () => {
                    if (isResolved) return <CheckCircle className="h-4 w-4 text-success" />;
                    if (incident.severity === 'critical') return <XCircle className="h-4 w-4 text-destructive" />;
                    return <AlertCircle className="h-4 w-4 text-warning" />;
                  };
                  
                  const formatDuration = () => {
                    const end = resolvedDate || new Date();
                    const durationMs = end.getTime() - startDate.getTime();
                    const minutes = Math.floor(durationMs / 60000);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);
                    
                    if (days > 0) return `${days}d ${hours % 24}h`;
                    if (hours > 0) return `${hours}h ${minutes % 60}m`;
                    return `${minutes}m`;
                  };

                  return (
                    <div 
                      key={incident.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        isResolved 
                          ? "border-border bg-card" 
                          : "border-destructive/30 bg-destructive/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getStatusIcon()}
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {incident.title}
                            </div>
                            {incident.description && (
                              <p className="text-sm text-muted-foreground">
                                {incident.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {startDate.toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: startDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span>•</span>
                              <span>Duration: {formatDuration()}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={getSeverityVariant()} className="text-xs shrink-0">
                          {isResolved ? 'Resolved' : incident.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mb-3 text-success/50" />
                <p className="text-sm">No incidents recorded</p>
                <p className="text-xs mt-1">This monitor has been running smoothly</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
