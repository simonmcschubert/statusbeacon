/**
 * Centralized configuration paths
 * Single source of truth for config file locations
 */

export const CONFIG_PATHS = {
  config: process.env.CONFIG_PATH || './config/config.yml',
  monitors: process.env.MONITORS_PATH || './config/monitors.yml',
} as const;
