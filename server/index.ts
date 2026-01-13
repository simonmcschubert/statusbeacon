import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ConfigLoader } from './config/loader.js';
import { MonitorRunner } from './monitors/runner.js';
import { scheduleMonitors, reloadMonitors, shutdownQueue } from './queue/monitor-queue.js';
import { IncidentRepository } from './repositories/incident-repository.js';
import { CheckRepository } from './repositories/check-repository.js';
import { StatusHistoryRepository } from './repositories/status-history-repository.js';
import { MonitorRepository } from './repositories/monitor-repository.js';
import { MaintenanceRepository } from './repositories/maintenance-repository.js';
import { scheduleDailyAggregation, scheduleHourlyAggregation, backfillHistoryOnStartup } from './jobs/daily-aggregation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Load configurations
let appConfig;
let monitorsConfig;

try {
  appConfig = ConfigLoader.loadAppConfig();
  monitorsConfig = ConfigLoader.loadMonitorsConfig();
  console.log(`📋 Loaded ${monitorsConfig.monitors.length} monitors`);
} catch (error) {
  console.error('⚠️  Failed to load config files. Using example configs.');
  console.error('   Copy config.example.yml to config.yml and monitors.example.yml to monitors.yml');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api/config', (req, res) => {
  if (!appConfig) {
    return res.status(500).json({ error: 'Config not loaded' });
  }
  res.json({
    app: appConfig.app,
    ui: appConfig.ui,
  });
});

app.get('/api/monitors', async (req, res) => {
  if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  try {
    const publicMonitors = monitorsConfig.monitors.filter(m => m.public);
    
    // Enrich each monitor with stats
    const enrichedMonitors = await Promise.all(
      publicMonitors.map(async (monitor) => {
        const monitorId = monitor.id || 0;
        const uptime = await CheckRepository.calculateUptime(monitorId, 90);
        const avgResponseTime = await CheckRepository.getAverageResponseTime(monitorId, 30);
        const latestCheck = await CheckRepository.getLatestCheck(monitorId);
        const history = await StatusHistoryRepository.getHistory(monitorId, 90);
        const maintenanceStatus = await MaintenanceRepository.isInMaintenance(monitorId);
        
        // Determine current status - maintenance takes precedence
        let currentStatus: string = 'unknown';
        if (maintenanceStatus.inMaintenance) {
          currentStatus = 'maintenance';
        } else if (latestCheck?.success) {
          currentStatus = 'up';
        } else if (latestCheck) {
          currentStatus = 'down';
        }
        
        return {
          ...monitor,
          id: monitorId,
          uptime,
          avgResponseTime,
          currentStatus,
          uptimeHistory: history.map(h => ({
            date: h.date,
            uptime: h.uptimePercentage,
          })),
          maintenance: maintenanceStatus.inMaintenance ? {
            active: true,
            description: maintenanceStatus.window?.description,
            endsAt: maintenanceStatus.window?.endTime,
          } : undefined,
        };
      })
    );
    
    res.json({ monitors: enrichedMonitors });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch monitors';
    res.status(500).json({ error: message });
  }
});

app.get('/api/monitors/:id', async (req, res) => {
  if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  const monitorId = parseInt(req.params.id);
  const monitor = monitorsConfig.monitors.find(m => m.id === monitorId && m.public);
  
  if (!monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }
  
  try {
    // Get additional stats
    const uptime = await CheckRepository.calculateUptime(monitorId, 90);
    const avgResponseTime = await CheckRepository.getAverageResponseTime(monitorId, 30);
    const history = await StatusHistoryRepository.getHistory(monitorId, 90);
    const latestCheck = await CheckRepository.getLatestCheck(monitorId);
    const responseTimeHistory = await CheckRepository.getResponseTimeHistory(monitorId, 30, 'day');
    const recentChecks = await CheckRepository.getRecentResponseTimes(monitorId, 100);
    const incidents = await IncidentRepository.getIncidentsForMonitor(monitorId, 20);
    const maintenanceStatus = await MaintenanceRepository.isInMaintenance(monitorId);
    const upcomingMaintenance = await MaintenanceRepository.getUpcomingMaintenance(monitorId, 5);
    
    // Determine current status - maintenance takes precedence
    let currentStatus: string = 'unknown';
    if (maintenanceStatus.inMaintenance) {
      currentStatus = 'maintenance';
    } else if (latestCheck?.success) {
      currentStatus = 'up';
    } else if (latestCheck) {
      currentStatus = 'down';
    }
    
    res.json({
      ...monitor,
      uptime,
      avgResponseTime,
      currentStatus,
      uptimeHistory: history.map(h => ({
        date: h.date,
        uptime: h.uptimePercentage,
      })),
      responseTimeHistory,
      recentChecks,
      incidents: incidents.map(i => ({
        id: i.id,
        status: i.status,
        severity: i.severity,
        title: i.title,
        description: i.description,
        startedAt: i.startedAt,
        resolvedAt: i.resolvedAt,
      })),
      maintenance: maintenanceStatus.inMaintenance ? {
        active: true,
        description: maintenanceStatus.window?.description,
        endsAt: maintenanceStatus.window?.endTime,
      } : { active: false },
      upcomingMaintenance: upcomingMaintenance.map(m => ({
        startTime: m.startTime,
        endTime: m.endTime,
        description: m.description,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch monitor';
    res.status(500).json({ error: message });
  }
});

app.get('/api/status', async (req, res) => {
  if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }

  try {
    const results = await MonitorRunner.runChecks(monitorsConfig.monitors);
    res.json({
      timestamp: new Date().toISOString(),
      monitors: results.map(r => ({
        name: r.monitorName,
        success: r.success,
        responseTime: r.responseTime,
        error: r.error,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run checks' });
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const incidents = activeOnly
      ? await IncidentRepository.getActiveIncidents()
      : await IncidentRepository.getAllIncidents();
    
    res.json({ incidents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch incidents';
    res.status(500).json({ error: message });
  }
});

// Test endpoint to run checks manually
app.post('/api/test-check', async (req, res) => {
  if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  try {
    const results = await MonitorRunner.runChecks(monitorsConfig.monitors);
    res.json({
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run test checks';
    res.status(500).json({ error: message });
  }
});

// Reload monitors endpoint
app.post('/api/reload-monitors', async (req, res) => {
  try {
    ConfigLoader.reloadConfigs();
    appConfig = ConfigLoader.loadAppConfig();
    monitorsConfig = ConfigLoader.loadMonitorsConfig();
    await reloadMonitors();
    res.json({ 
      message: 'Monitors reloaded successfully',
      count: monitorsConfig.monitors.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reload monitors';
    res.status(500).json({ error: message });
  }
});

// Get monitor statistics
app.get('/api/monitors/:id/stats', async (req, res) => {
  try {
    const monitorId = parseInt(req.params.id);
    const days = parseInt(req.query.days as string) || 30;
    
    const uptime = await CheckRepository.calculateUptime(monitorId, days);
    const avgResponseTime = await CheckRepository.getAverageResponseTime(monitorId, days);
    const history = await StatusHistoryRepository.getHistory(monitorId, days);
    
    res.json({
      monitorId,
      uptime,
      avgResponseTime,
      history,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats';
    res.status(500).json({ error: message });
  }
});

// Aggregate daily status (manual trigger - should normally run via cron)
app.post('/api/admin/aggregate-status', async (req, res) => {
  try {
    await StatusHistoryRepository.aggregateAllYesterday();
    res.json({ message: 'Status history aggregated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to aggregate status';
    res.status(500).json({ error: message });
  }
});

// Reload monitors from config
app.post('/api/admin/reload-monitors', async (req, res) => {
  try {
    monitorsConfig = ConfigLoader.loadMonitorsConfig();
    await MonitorRepository.syncMonitors(monitorsConfig.monitors);
    await reloadMonitors();
    res.json({ 
      message: 'Monitors reloaded successfully',
      count: monitorsConfig.monitors.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reload monitors';
    res.status(500).json({ error: message });
  }
});

// Catch-all route for SPA - must be after API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Status Page server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test checks: POST http://localhost:${PORT}/api/test-check`);
  
  // Sync monitors from config to database, then schedule checks
  if (monitorsConfig) {
    try {
      await MonitorRepository.syncMonitors(monitorsConfig.monitors);
      await scheduleMonitors();
      console.log(`⏰ Scheduled ${monitorsConfig.monitors.length} monitors with BullMQ`);
      
      // Backfill any missing historical data
      await backfillHistoryOnStartup();
      
      // Schedule daily and hourly aggregation jobs
      scheduleDailyAggregation();
      scheduleHourlyAggregation();
    } catch (error) {
      console.error('❌ Failed to schedule monitors:', error);
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await shutdownQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await shutdownQueue();
  process.exit(0);
});
