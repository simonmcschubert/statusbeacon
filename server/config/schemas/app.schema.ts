import { z } from 'zod';

// UI Theme schema
const UIThemeSchema = z.object({
  default_mode: z.enum(['dark', 'light', 'auto']).default('auto'),
});

// UI Charts schema
const UIChartsSchema = z.object({
  show_response_time: z.boolean().default(true),
  show_uptime_bars: z.boolean().default(true),
  default_timeframe: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
});

// UI schema
// Note: Colors are defined in client/src/styles/index.css, not in config
const UISchema = z.object({
  theme: UIThemeSchema.optional(),
  charts: UIChartsSchema.optional(),
}).optional();

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

// Data retention schema
const DataSchema = z.object({
  retention_days: z.number().min(7).max(365).default(90),
  incidents_retention_days: z.number().min(30).max(730).default(365),
}).optional();

// Announcement schema for status page banners
const AnnouncementSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['info', 'warning', 'maintenance']).default('info'),
  active: z.boolean().default(true),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
});

// Main config schema
export const AppConfigSchema = z.object({
  app: AppSchema,
  ui: UISchema,
  notifications: NotificationsSchema,
  maintenance: z.array(MaintenanceWindowSchema).optional(),
  data: DataSchema,
  announcements: z.array(AnnouncementSchema).optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type Announcement = z.infer<typeof AnnouncementSchema>;
