import 'dotenv/config';
import { ConfigLoader } from './config/loader.js';
import { startConfigWatcher, stopConfigWatcher } from './config/watcher.js';
import { scheduleMonitors, shutdownQueue } from './queue/monitor-queue.js';
import { MonitorRepository } from './repositories/monitor-repository.js';
import { scheduleDailyAggregation, scheduleHourlyAggregation, backfillHistoryOnStartup } from './jobs/daily-aggregation.js';
import { scheduleDataRetention } from './jobs/data-retention.js';
import { bootstrapAdmin } from './bootstrap.js';
import { createApp } from './app.js';

// Load configurations
let PORT = 3001;

// Helpers to get current config (always fresh from ConfigLoader for hot reload support)
const getMonitorsConfig = () => ConfigLoader.getMonitorsConfig();
const getAppConfig = () => ConfigLoader.getAppConfig();

try {
  ConfigLoader.loadAppConfig(); // Initialize app config
  ConfigLoader.loadMonitorsConfig(); // Initialize monitors config

  const appConfig = getAppConfig();

  // Get PORT from config or env var
  PORT = appConfig.server?.port || parseInt(process.env.PORT || '3001');

  console.log(`📋 Loaded ${getMonitorsConfig().monitors.length} monitors`);
} catch (_error) {
  PORT = parseInt(process.env.PORT || '3001');
  console.error('⚠️  Failed to load config files. Using example configs.');
  console.error('   Copy config.example.yml to config.yml and monitors.example.yml to monitors.yml');
}

const app = createApp();

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
