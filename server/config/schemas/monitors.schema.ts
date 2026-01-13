import { z } from 'zod';

// Monitor condition schema
const ConditionSchema = z.string();

// One-time maintenance window
const OneTimeMaintenanceSchema = z.object({
  type: z.literal('one-time').optional(), // default if not specified
  start: z.string(),  // "2026-01-15 02:00"
  end: z.string(),    // "2026-01-15 04:00"
  timezone: z.string().default('UTC'),
  description: z.string().optional(),
});

// Recurring daily maintenance window
const RecurringMaintenanceSchema = z.object({
  type: z.literal('daily'),
  start_time: z.string(),  // "09:00" (24h format)
  end_time: z.string(),    // "09:15"
  timezone: z.string().default('UTC'),
  description: z.string().optional(),
});

// Combined maintenance schema
const MaintenanceSchema = z.union([OneTimeMaintenanceSchema, RecurringMaintenanceSchema]);

// Monitor schema
export const MonitorSchema = z.object({
  id: z.number(),
  name: z.string(),
  group: z.string().optional(),
  url: z.string(),
  type: z.enum(['http', 'tcp', 'websocket', 'dns', 'ping']),
  interval: z.number().min(10),
  public: z.boolean().default(true),
  conditions: z.array(ConditionSchema),
  maintenance: z.array(MaintenanceSchema).optional(),
  dns: z.object({
    query_name: z.string(),
    query_type: z.string(),
  }).optional(),
});

export type Monitor = z.infer<typeof MonitorSchema>;
export type MaintenanceWindow = z.infer<typeof MaintenanceSchema>;

// Monitors file schema
export const MonitorsConfigSchema = z.object({
  monitors: z.array(MonitorSchema),
});

export type MonitorsConfig = z.infer<typeof MonitorsConfigSchema>;
