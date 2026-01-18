import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import { ConfigLoader } from './loader.js';
import { CONFIG_PATHS } from './paths.js';
import { reloadMonitors } from '../queue/monitor-queue.js';
import { MonitorRepository } from '../repositories/monitor-repository.js';

let watcher: FSWatcher | null = null;

/**
 * Start watching config files for changes and automatically reload.
 * Uses chokidar for robust cross-platform file watching.
 */
export function startConfigWatcher(): FSWatcher {
  const configPath = path.resolve(CONFIG_PATHS.config);
  const monitorsPath = path.resolve(CONFIG_PATHS.monitors);

  watcher = chokidar.watch([configPath, monitorsPath], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('change', async (filePath: string) => {
    console.log(`🔄 Config file changed: ${filePath}`);

    try {
      // Validate configs before applying (fail fast)
      ConfigLoader.validateConfigs();
      console.log('  ✓ Config validation passed');

      // Reload configurations from disk
      ConfigLoader.reloadConfigs();

      // Get the updated monitors config
      const monitorsConfig = ConfigLoader.getMonitorsConfig();

      // Sync monitors to database
      await MonitorRepository.syncMonitors(monitorsConfig.monitors);

      // Reschedule all monitor jobs
      await reloadMonitors();

      console.log('✅ Config reloaded successfully');
    } catch (error) {
      console.error('❌ Failed to reload config:', error);
      console.error('   Keeping previous configuration');
      // Don't crash the server on config errors - keep running with old config
    }
  });

  watcher.on('error', (error) => {
    console.error('❌ Config watcher error:', error);
  });

  console.log(`👀 Watching: ${configPath}`);
  console.log(`👀 Watching: ${monitorsPath}`);
  console.log('🔄 Hot reload enabled - config changes will be applied automatically');

  return watcher;
}

/**
 * Stop the config file watcher
 */
export async function stopConfigWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    console.log('👀 Config watcher stopped');
  }
}
