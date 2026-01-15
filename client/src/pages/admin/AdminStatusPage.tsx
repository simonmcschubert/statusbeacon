import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Activity, Server, Lock, Pencil, Plus } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { UptimeBar } from '../../components/UptimeBar';
import { Badge } from '../../components/ui/badge';
import { useSmartPolling } from '../../hooks/useSmartPolling';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import type { Monitor } from '../../types';

export function AdminStatusPage() {
  const { accessToken } = useAuth();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const response = await fetch('/api/admin/status', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Failed to fetch status';
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If not JSON, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setMonitors(data.monitors || []);
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
        <Skeleton className="h-24 w-full bg-gray-700" />
        <Skeleton className="h-12 w-full bg-gray-700" />
        <Skeleton className="h-12 w-full bg-gray-700" />
        <Skeleton className="h-12 w-full bg-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
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
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Status Overview</h1>
          <p className="text-gray-400 mt-1">All services including private monitors</p>
        </div>
        <Link
          to="/admin/monitors/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Monitor
        </Link>
      </div>

      {/* Status Banner */}
      <div className={cn(
        "p-6 rounded-lg",
        allDown && "bg-red-500/20 border border-red-500/30",
        hasIssues && !allDown && "bg-yellow-500/20 border border-yellow-500/30",
        !hasIssues && "bg-green-500/20 border border-green-500/30"
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-full",
            allDown && "bg-red-500/30 text-red-400",
            hasIssues && !allDown && "bg-yellow-500/30 text-yellow-400",
            !hasIssues && "bg-green-500/30 text-green-400"
          )}>
            {getStatusIcon()}
          </div>
          <div>
            <h2 className={cn(
              "text-xl font-bold",
              allDown && "text-red-400",
              hasIssues && !allDown && "text-yellow-400",
              !hasIssues && "text-green-400"
            )}>
              {getStatusText()}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="pt-6 text-center">
            <div className={cn(
              "text-2xl font-bold",
              overallUptime >= 99.9 ? "text-green-400" :
              overallUptime >= 99 ? "text-yellow-400" : "text-red-400"
            )}>
              {overallUptime.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-400 mt-1">Overall Uptime</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <Server className="h-5 w-5 text-gray-400" />
              {monitors.length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Services</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-400 flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {monitors.filter(m => m.currentStatus === 'up').length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Operational</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-gray-400 flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              {privateMonitors.length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Private</div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">
              Uptime
            </h2>
            <span className="text-sm text-gray-400">Last 90 days</span>
          </div>
        </div>

        <div className="space-y-3">
          {monitors.map((monitor) => (
            <AdminMonitorRow key={monitor.id} monitor={monitor} />
          ))}
          {monitors.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No monitors configured yet.{' '}
              <Link to="/admin/monitors/new" className="text-blue-400 hover:underline">
                Add your first monitor
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Admin-enhanced monitor row with edit button and visibility indicator
function AdminMonitorRow({ monitor }: { monitor: Monitor }) {
  const uptimePercent = monitor.uptime ?? 100;
  
  const getStatusConfig = () => {
    if (monitor.currentStatus === 'maintenance') {
      return {
        icon: AlertTriangle,
        label: 'Maintenance',
        iconClass: 'text-blue-400',
        badgeClass: 'bg-blue-500/20 text-blue-400',
      };
    }
    if (monitor.currentStatus === 'down') {
      return {
        icon: XCircle,
        label: 'Down',
        iconClass: 'text-red-400',
        badgeClass: 'bg-red-500/20 text-red-400',
      };
    }
    if (monitor.currentStatus === 'degraded') {
      return {
        icon: AlertTriangle,
        label: 'Degraded',
        iconClass: 'text-yellow-400',
        badgeClass: 'bg-yellow-500/20 text-yellow-400',
      };
    }
    return {
      icon: CheckCircle,
      label: 'Operational',
      iconClass: 'text-green-400',
      badgeClass: 'bg-green-500/20 text-green-400',
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <div className="group rounded-lg border border-gray-700 bg-gray-800 p-4 transition-all hover:border-gray-600">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Name and Status Icon */}
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon className={cn("h-5 w-5 shrink-0", status.iconClass)} />
          <div className="min-w-0 flex items-center gap-2">
            <h3 className="font-medium text-white truncate">
              {monitor.name}
            </h3>
            {!monitor.public && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
            {monitor.group && (
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                {monitor.group}
              </span>
            )}
          </div>
        </div>

        {/* Center: Uptime Bar (hidden on small screens) */}
        <div className="hidden md:block flex-1 max-w-md px-4">
          <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
        </div>

        {/* Right: Uptime %, Status Badge, and Edit button */}
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
            <div className="text-xs text-gray-400">uptime</div>
          </div>
          
          <Badge className={cn("hidden xs:flex", status.badgeClass)}>
            {status.label}
          </Badge>
          
          <Link
            to={`/admin/monitors/${monitor.id}`}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit monitor"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Mobile: Uptime Bar */}
      <div className="md:hidden mt-3 pt-3 border-t border-gray-700">
        <UptimeBar uptimeHistory={monitor.uptimeHistory} days={90} />
      </div>
    </div>
  );
}
