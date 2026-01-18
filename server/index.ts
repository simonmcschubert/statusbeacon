import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigLoader } from './config/loader.js';
import { startConfigWatcher, stopConfigWatcher } from './config/watcher.js';
import { MonitorRunner } from './monitors/runner.js';
import { scheduleMonitors, shutdownQueue } from './queue/monitor-queue.js';
import { IncidentRepository } from './repositories/incident-repository.js';
import { CheckRepository } from './repositories/check-repository.js';
import { StatusHistoryRepository } from './repositories/status-history-repository.js';
import { MonitorRepository } from './repositories/monitor-repository.js';
import { MaintenanceRepository } from './repositories/maintenance-repository.js';
import { scheduleDailyAggregation, scheduleHourlyAggregation, backfillHistoryOnStartup } from './jobs/daily-aggregation.js';
import { scheduleDataRetention } from './jobs/data-retention.js';
import type { Announcement } from './config/schemas/app.schema.js';
import { AuthService } from './services/auth-service.js';
import { UserRepository } from './repositories/user-repository.js';
import { requireAuth } from './middleware/auth.js';
import { bootstrapAdmin } from './bootstrap.js';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Serve static frontend files with efficient caching
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');

// Cache hashed assets (JS, CSS) for 1 year (immutable)
app.use('/assets', express.static(path.join(clientDistPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Cache other static files for 1 hour, revalidate
app.use(express.static(clientDistPath, {
  maxAge: '1h',
  etag: true,
}));

// Load configurations
let PORT = 3000;

// Helpers to get current config (always fresh from ConfigLoader for hot reload support)
const getMonitorsConfig = () => ConfigLoader.getMonitorsConfig();
const getAppConfig = () => ConfigLoader.getAppConfig();

try {
  ConfigLoader.loadAppConfig(); // Initialize app config
  ConfigLoader.loadMonitorsConfig(); // Initialize monitors config
  
  const appConfig = getAppConfig();
  
  // Get PORT from config or env var
  PORT = appConfig.server?.port || parseInt(process.env.PORT || '3000');
  
  console.log(`📋 Loaded ${getMonitorsConfig().monitors.length} monitors`);
} catch (_error) {
  PORT = parseInt(process.env.PORT || '3000');
  console.error('⚠️  Failed to load config files. Using example configs.');
  console.error('   Copy config.example.yml to config.yml and monitors.example.yml to monitors.yml');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Auth routes
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await AuthService.login(email, password);
    
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.status(500).json({ error: message });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Refresh access token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const result = await AuthService.refresh(refreshToken);
    
    if (!result) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (_error) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Get current user (protected)
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await UserRepository.findById(req.user!.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Change password (protected)
app.put('/api/auth/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const success = await AuthService.changePassword(
      req.user!.userId,
      currentPassword,
      newPassword
    );
    
    if (!success) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Check if setup is needed
app.get('/api/auth/setup-required', async (req, res) => {
  try {
    const userCount = await UserRepository.count();
    res.json({ setupRequired: userCount === 0 });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// ============================================
// API routes
// ============================================
app.get('/api/config', async (req, res) => {
  try {
    // Get merged config (DB settings override YAML defaults)
    const mergedConfig = await ConfigLoader.getMergedAppConfig();
    res.json({
      app: mergedConfig.app,
      ui: mergedConfig.ui,
      footer: mergedConfig.footer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load config';
    res.status(500).json({ error: message });
  }
});

app.get('/api/monitors', async (req, res) => {
  const monitorsConfig = getMonitorsConfig(); if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  try {
    // Get public monitor IDs from database (source of truth for visibility)
    const publicMonitorIds = await MonitorRepository.getPublicMonitorIds();
    const publicMonitors = monitorsConfig.monitors.filter(m => publicMonitorIds.has(m.id || 0));
    
    // Enrich each monitor with stats
    const enrichedMonitors = await Promise.all(
      publicMonitors.map(async (monitor) => {
        const monitorId = monitor.id || 0;
        // Use status_history for uptime (more accurate for historical data)
        const history = await StatusHistoryRepository.getHistory(monitorId, 90);
        const uptime = history.length > 0 
          ? await StatusHistoryRepository.calculateAverageUptime(monitorId, 90)
          : await CheckRepository.calculateUptime(monitorId, 90);
        const avgResponseTime = await CheckRepository.getAverageResponseTime(monitorId, 30);
        const latestCheck = await CheckRepository.getLatestCheck(monitorId);
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
            description: maintenanceStatus.description || maintenanceStatus.window?.description,
            endsAt: maintenanceStatus.endsAt || maintenanceStatus.window?.endTime,
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
  const monitorsConfig = getMonitorsConfig(); if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  const monitorId = parseInt(req.params.id);
  const monitor = monitorsConfig.monitors.find(m => m.id === monitorId);
  
  // Check database for public status (source of truth for visibility)
  const isPublic = await MonitorRepository.isPublic(monitorId);
  
  if (!monitor || !isPublic) {
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
        description: maintenanceStatus.description || maintenanceStatus.window?.description,
        endsAt: maintenanceStatus.endsAt || maintenanceStatus.window?.endTime,
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
  const monitorsConfig = getMonitorsConfig(); if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }

  try {
    // Only run checks for public monitors
    const publicMonitorIds = await MonitorRepository.getPublicMonitorIds();
    const publicMonitors = monitorsConfig.monitors.filter(m => publicMonitorIds.has(m.id || 0));
    const results = await MonitorRunner.runChecks(publicMonitors);
    res.json({
      timestamp: new Date().toISOString(),
      monitors: results.map(r => ({
        name: r.monitorName,
        success: r.success,
        responseTime: r.responseTime,
        error: r.error,
      })),
    });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to run checks' });
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const incidents = activeOnly
      ? await IncidentRepository.getActiveIncidents()
      : await IncidentRepository.getAllIncidents();
    
    // Filter to only show incidents for public monitors
    const publicMonitorIds = await MonitorRepository.getPublicMonitorIds();
    const publicIncidents = incidents.filter(i => publicMonitorIds.has(i.monitorId));
    
    res.json({ incidents: publicIncidents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch incidents';
    res.status(500).json({ error: message });
  }
});

// Get active announcements for status page
app.get('/api/announcements', async (req, res) => {
  try {
    const appConfig = getAppConfig();
    const announcements = appConfig?.announcements ?? [];
    const now = new Date();
    
    // Filter to only active announcements within their date range
    const activeAnnouncements = announcements.filter((a: Announcement) => {
      if (!a.active) return false;
      
      if (a.starts_at && new Date(a.starts_at) > now) return false;
      if (a.ends_at && new Date(a.ends_at) < now) return false;
      
      return true;
    });
    
    res.json({ announcements: activeAnnouncements });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch announcements';
    res.status(500).json({ error: message });
  }
});

// Test endpoint to run checks manually
app.post('/api/test-check', async (req, res) => {
  const monitorsConfig = getMonitorsConfig(); if (!monitorsConfig) {
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
    const monitorsConfig = getMonitorsConfig();
    await MonitorRepository.syncMonitors(monitorsConfig.monitors);
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
app.post('/api/admin/aggregate-status', requireAuth, async (req, res) => {
  try {
    await StatusHistoryRepository.aggregateAllYesterday();
    res.json({ message: 'Status history aggregated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to aggregate status';
    res.status(500).json({ error: message });
  }
});

// Reload monitors from config
app.post('/api/admin/reload-monitors', requireAuth, async (req, res) => {
  try {
    ConfigLoader.reloadConfigs();
    const monitorsConfig = getMonitorsConfig();
    await MonitorRepository.syncMonitors(monitorsConfig.monitors);
    res.json({ 
      message: 'Monitors reloaded successfully',
      count: monitorsConfig.monitors.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reload monitors';
    res.status(500).json({ error: message });
  }
});

// ============================================
// Admin API routes (protected)
// ============================================

// Get all monitors with enriched status data (admin view - includes private monitors)
app.get('/api/admin/status', requireAuth, async (req, res) => {
  const monitorsConfig = getMonitorsConfig(); if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  try {
    // Get ALL monitors (including private ones)
    const allMonitors = monitorsConfig.monitors;
    
    // Get public status from database for all monitors
    const publicMonitorIds = await MonitorRepository.getPublicMonitorIds();
    
    // Enrich each monitor with stats (same as public endpoint)
    const enrichedMonitors = await Promise.all(
      allMonitors.map(async (monitor) => {
        const monitorId = monitor.id || 0;
        const avgResponseTime = await CheckRepository.getAverageResponseTime(monitorId, 30);
        const latestCheck = await CheckRepository.getLatestCheck(monitorId);
        const history = await StatusHistoryRepository.getHistory(monitorId, 90);
        // Use status_history for accurate uptime (checks table data was corrupted)
        const uptime = history.length > 0 
          ? await StatusHistoryRepository.calculateAverageUptime(monitorId, 90)
          : await CheckRepository.calculateUptime(monitorId, 90);
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
          // Use database value for public status
          public: publicMonitorIds.has(monitorId),
          uptime,
          avgResponseTime,
          currentStatus,
          uptimeHistory: history.map(h => ({
            date: h.date,
            uptime: h.uptimePercentage,
          })),
          maintenance: maintenanceStatus.inMaintenance ? {
            active: true,
            description: maintenanceStatus.description || maintenanceStatus.window?.description,
            endsAt: maintenanceStatus.endsAt || maintenanceStatus.window?.endTime,
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

// Get detailed monitor stats (for admin detail page)
app.get('/api/admin/monitors/:id/details', requireAuth, async (req, res) => {
  const monitorsConfig = getMonitorsConfig(); if (!monitorsConfig) {
    return res.status(500).json({ error: 'Monitors config not loaded' });
  }
  
  const monitorId = parseInt(req.params.id);
  // For admin, find monitor regardless of public status
  const monitor = monitorsConfig.monitors.find(m => m.id === monitorId);
  
  if (!monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }
  
  try {
    // Get public status from database (source of truth)
    const isPublic = await MonitorRepository.isPublic(monitorId);
    
    // Get additional stats (same as public detail endpoint)
    const history = await StatusHistoryRepository.getHistory(monitorId, 90);
    const uptime = history.length > 0 
      ? await StatusHistoryRepository.calculateAverageUptime(monitorId, 90)
      : await CheckRepository.calculateUptime(monitorId, 90);
    const avgResponseTime = await CheckRepository.getAverageResponseTime(monitorId, 30);
    const latestCheck = await CheckRepository.getLatestCheck(monitorId);
    const responseTimeHistory = await CheckRepository.getResponseTimeHistory(monitorId, 30, 'day');
    const recentChecks = await CheckRepository.getRecentResponseTimes(monitorId, 100);
    const incidents = await IncidentRepository.getIncidentsForMonitor(monitorId, 20);
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
    
    res.json({
      ...monitor,
      public: isPublic,
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
        description: maintenanceStatus.description || maintenanceStatus.window?.description,
        endsAt: maintenanceStatus.endsAt || maintenanceStatus.window?.endTime,
      } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch monitor details';
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
  
  // Bootstrap admin user from environment variables
  try {
    await bootstrapAdmin();
  } catch (error) {
    console.error('❌ Failed to bootstrap admin:', error);
  }
  
  // Sync monitors from config to database, then schedule checks
  const monitorsConfig = getMonitorsConfig();
  const appConfig = ConfigLoader.getAppConfig();
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
      
      // Schedule data retention cleanup
      if (appConfig) {
        scheduleDataRetention(appConfig);
      }
    } catch (error) {
      console.error('❌ Failed to schedule monitors:', error);
    }
  }
  
  // Start config file watcher for hot reload (unless disabled)
  if (process.env.WATCH_CONFIG !== 'false') {
    startConfigWatcher();
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await stopConfigWatcher();
  await shutdownQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await stopConfigWatcher();
  await shutdownQueue();
  process.exit(0);
});
