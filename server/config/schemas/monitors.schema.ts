import { z } from 'zod';

// Monitor condition schema
const ConditionSchema = z.string();

// Monitor schema
export const MonitorSchema = z.object({
  name: z.string(),
  group: z.string().optional(),
  url: z.string(),
  type: z.enum(['http', 'tcp', 'websocket', 'dns', 'ping']),
  interval: z.number().min(10),
  public: z.boolean().default(true),
  conditions: z.array(ConditionSchema),
  maintenance: z.array(z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string().default('UTC'),
    description: z.string().optional(),
  })).optional(),
  dns: z.object({
    query_name: z.string(),
    query_type: z.string(),
  }).optional(),
});

export type Monitor = z.infer<typeof MonitorSchema>;

// Monitors file schema
export const MonitorsConfigSchema = z.object({
  monitors: z.array(MonitorSchema),
});

export type MonitorsConfig = z.infer<typeof MonitorsConfigSchema>;
