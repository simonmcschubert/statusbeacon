import { z } from 'zod';

// UI Theme schema
const UIThemeSchema = z.object({
  default_mode: z.enum(['dark', 'light', 'auto']).default('dark'),
  primary_color: z.string().default('#3b82f6'),
  success_color: z.string().default('#10b981'),
  warning_color: z.string().default('#f59e0b'),
  danger_color: z.string().default('#ef4444'),
});

// UI Charts schema
const UIChartsSchema = z.object({
  show_response_time: z.boolean().default(true),
  show_uptime_bars: z.boolean().default(true),
  default_timeframe: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
});

// UI schema
const UISchema = z.object({
  theme: UIThemeSchema,
  charts: UIChartsSchema,
});

// App schema
const AppSchema = z.object({
  title: z.string(),
  description: z.string(),
  logo_url: z.string().optional(),
  timezone: z.string().default('UTC'),
  noindex: z.boolean().default(true),
});

// Notifications schema
const NotificationsSchema = z.object({
  webhook_url: z.string().url(),
  cooldown: z.number().min(0).default(300),
  template: z.string(),
});

// Maintenance window schema
const MaintenanceWindowSchema = z.object({
  start: z.string(),
  duration: z.string(),
  timezone: z.string().default('UTC'),
  every: z.array(z.string()).optional(),
  description: z.string().optional(),
});

// Main config schema
export const AppConfigSchema = z.object({
  app: AppSchema,
  ui: UISchema,
  notifications: NotificationsSchema,
  maintenance: z.array(MaintenanceWindowSchema).optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
