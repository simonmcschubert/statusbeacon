import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigLoader } from '../config/loader.js';
import { MonitorRunner } from '../monitors/runner.js';
import { IncidentDetector } from '../services/incident-detector.js';
import type { Monitor } from '../config/schemas/monitors.schema.js';

const QUEUE_NAME = 'monitor-checks';

// Get Redis connection options from config (YAML) or fall back to environment variables
function getRedisOptions(): { host: string; port: number } {
  try {
    const config = ConfigLoader.getAppConfig();
    if (config.redis?.url) {
      const url = new URL(config.redis.url);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
      };
    }
    if (config.redis?.host) {
      return {
        host: config.redis.host,
        port: config.redis.port || 6379,
      };
    }
  } catch {
    // Config not loaded yet, use env vars
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };
}

// Redis connection for BullMQ
const redisOptions = getRedisOptions();
const connection = new Redis({
  host: redisOptions.host,
  port: redisOptions.port,
  maxRetriesPerRequest: null, // Required for BullMQ
}) as any; // Type assertion for BullMQ compatibility

// Create queue for monitor checks
export const monitorQueue = new Queue(QUEUE_NAME, { connection });

interface MonitorJobData {
  monitor: Monitor;
  monitorId?: number;
}

// Worker to process monitor checks
export const monitorWorker = new Worker<MonitorJobData>(
  QUEUE_NAME,
  async (job: Job<MonitorJobData>) => {
    const { monitor, monitorId } = job.data;
    
    console.log(`[Worker] Running check for monitor: ${monitor.name}`);
    
    try {
      const result = await MonitorRunner.runCheck(monitor, monitorId);
      
      // Process check result (save to DB, update incidents, send notifications)
      await IncidentDetector.processCheckResult(result);
      
      return result;
    } catch (error) {
      console.error(`[Worker] Error checking ${monitor.name}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 10, // Process up to 10 monitors concurrently
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 500 }, // Keep last 500 failed jobs
  }
);

// Event handlers
monitorWorker.on('completed', (job) => {
  console.log(`[Worker] Completed check for job ${job.id}`);
});

monitorWorker.on('failed', (job, err) => {
  console.error(`[Worker] Failed check for job ${job?.id}:`, err.message);
});

monitorWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

// Schedule all monitors from config
export async function scheduleMonitors() {
  const config = ConfigLoader.loadMonitorsConfig();
  const monitors = config.monitors;
  
  console.log(`[Scheduler] Scheduling ${monitors.length} monitors`);
  
  for (let i = 0; i < monitors.length; i++) {
    const monitor = monitors[i];
    const monitorId = i + 1; // Simple ID for now, will use DB ID later
    
    // Add repeatable job based on monitor interval
    await monitorQueue.add(
      `check-${monitor.name}`,
      { monitor, monitorId },
      {
        repeat: {
          every: monitor.interval * 1000, // Convert seconds to milliseconds
        },
        jobId: `monitor-${monitorId}`, // Unique job ID to prevent duplicates
      }
    );
    
    console.log(`[Scheduler] Scheduled ${monitor.name} (every ${monitor.interval}s)`);
  }
}

// Reload monitors (clear old jobs and reschedule)
export async function reloadMonitors() {
  console.log('[Scheduler] Reloading monitors...');
  
  // Remove all repeatable jobs
  const repeatableJobs = await monitorQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await monitorQueue.removeRepeatableByKey(job.key);
  }
  
  // Clear queue
  await monitorQueue.drain();
  
  // Reschedule
  await scheduleMonitors();
  
  console.log('[Scheduler] Monitors reloaded');
}

// Graceful shutdown
export async function shutdownQueue() {
  console.log('[Scheduler] Shutting down queue...');
  
  await monitorWorker.close();
  await monitorQueue.close();
  await connection.quit();
  
  console.log('[Scheduler] Queue shut down');
}
