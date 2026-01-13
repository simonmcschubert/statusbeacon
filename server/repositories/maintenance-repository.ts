import pool from '../db/index.js';
import type { MaintenanceWindow as ConfigMaintenanceWindow } from '../config/schemas/monitors.schema.js';

export interface MaintenanceWindow {
  id: number;
  monitorId: number | null;
  startTime: Date;
  endTime: Date;
  description?: string;
  timezone: string;
  createdAt: Date;
}

export interface RecurringMaintenanceConfig {
  type: 'daily';
  start_time: string;  // "09:00"
  end_time: string;    // "09:15"
  timezone?: string;
  description?: string;
}

/**
 * Check if current time is within a recurring daily maintenance window
 */
function isInRecurringWindow(config: RecurringMaintenanceConfig): { inMaintenance: boolean; description?: string; endsAt?: Date } {
  const now = new Date();
  const timezone = config.timezone || 'UTC';
  
  // Get current time in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const currentTimeStr = formatter.format(now);
  const [currentHour, currentMinute] = currentTimeStr.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;
  
  // Parse start and end times
  const [startHour, startMinute] = config.start_time.split(':').map(Number);
  const [endHour, endMinute] = config.end_time.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  // Check if current time is within the window
  let inMaintenance = false;
  if (startMinutes <= endMinutes) {
    // Normal case: start < end (e.g., 09:00 to 09:15)
    inMaintenance = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight case: start > end (e.g., 23:00 to 01:00)
    inMaintenance = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  if (inMaintenance) {
    // Calculate when maintenance ends (today)
    const endsAt = new Date(now);
    endsAt.setHours(endHour, endMinute, 0, 0);
    if (endMinutes < startMinutes && currentMinutes >= startMinutes) {
      // Overnight: ends tomorrow
      endsAt.setDate(endsAt.getDate() + 1);
    }
    
    return { inMaintenance: true, description: config.description, endsAt };
  }
  
  return { inMaintenance: false };
}

// Store recurring maintenance configs per monitor (loaded from config)
const recurringMaintenanceCache: Map<number, RecurringMaintenanceConfig[]> = new Map();

export class MaintenanceRepository {
  /**
   * Set recurring maintenance config for a monitor (called during config sync)
   */
  static setRecurringMaintenance(monitorId: number, configs: RecurringMaintenanceConfig[]): void {
    recurringMaintenanceCache.set(monitorId, configs);
  }

  /**
   * Create or update a maintenance window
   */
  static async upsertMaintenanceWindow(
    monitorId: number,
    startTime: Date,
    endTime: Date,
    description?: string,
    timezone: string = 'UTC'
  ): Promise<MaintenanceWindow> {
    // Check if this window already exists (by monitor + start time)
    const existing = await pool.query(
      `SELECT id FROM maintenance_windows 
       WHERE monitor_id = $1 AND start_time = $2`,
      [monitorId, startTime]
    );

    if (existing.rows.length > 0) {
      // Update existing
      const query = `
        UPDATE maintenance_windows
        SET end_time = $1, description = $2, timezone = $3
        WHERE id = $4
        RETURNING 
          id,
          monitor_id as "monitorId",
          start_time as "startTime",
          end_time as "endTime",
          description,
          timezone,
          created_at as "createdAt"
      `;
      const result = await pool.query(query, [endTime, description, timezone, existing.rows[0].id]);
      return result.rows[0];
    }

    // Create new
    const query = `
      INSERT INTO maintenance_windows (
        monitor_id, start_time, end_time, description, timezone
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        monitor_id as "monitorId",
        start_time as "startTime",
        end_time as "endTime",
        description,
        timezone,
        created_at as "createdAt"
    `;
    const result = await pool.query(query, [monitorId, startTime, endTime, description, timezone]);
    return result.rows[0];
  }

  /**
   * Check if a monitor is currently in a maintenance window
   */
  static async isInMaintenance(monitorId: number): Promise<{ inMaintenance: boolean; window?: MaintenanceWindow; description?: string; endsAt?: Date }> {
    // First check recurring daily maintenance from config
    const recurringConfigs = recurringMaintenanceCache.get(monitorId) || [];
    for (const config of recurringConfigs) {
      const result = isInRecurringWindow(config);
      if (result.inMaintenance) {
        return { 
          inMaintenance: true, 
          description: result.description,
          endsAt: result.endsAt,
        };
      }
    }

    // Then check one-time windows from database
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        start_time as "startTime",
        end_time as "endTime",
        description,
        timezone,
        created_at as "createdAt"
      FROM maintenance_windows
      WHERE 
        (monitor_id = $1 OR monitor_id IS NULL)
        AND start_time <= NOW()
        AND end_time >= NOW()
      ORDER BY start_time DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [monitorId]);
    
    if (result.rows.length > 0) {
      return { inMaintenance: true, window: result.rows[0] };
    }
    
    return { inMaintenance: false };
  }

  /**
   * Get upcoming maintenance windows for a monitor
   */
  static async getUpcomingMaintenance(monitorId: number, limit: number = 5): Promise<MaintenanceWindow[]> {
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        start_time as "startTime",
        end_time as "endTime",
        description,
        timezone,
        created_at as "createdAt"
      FROM maintenance_windows
      WHERE 
        (monitor_id = $1 OR monitor_id IS NULL)
        AND end_time >= NOW()
      ORDER BY start_time ASC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [monitorId, limit]);
    return result.rows;
  }

  /**
   * Get active maintenance windows (currently happening)
   */
  static async getActiveMaintenance(): Promise<MaintenanceWindow[]> {
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        start_time as "startTime",
        end_time as "endTime",
        description,
        timezone,
        created_at as "createdAt"
      FROM maintenance_windows
      WHERE 
        start_time <= NOW()
        AND end_time >= NOW()
      ORDER BY start_time DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Delete old maintenance windows (past end time)
   */
  static async cleanupOldWindows(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM maintenance_windows
      WHERE end_time < NOW() - INTERVAL '${daysOld} days'
    `;
    
    const result = await pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Sync maintenance windows from config to database
   */
  static async syncFromConfig(
    monitorId: number,
    maintenanceWindows: { start: string; end: string; timezone?: string; description?: string }[]
  ): Promise<void> {
    for (const window of maintenanceWindows) {
      const startTime = new Date(window.start);
      const endTime = new Date(window.end);
      
      // Only sync future or current windows
      if (endTime >= new Date()) {
        await this.upsertMaintenanceWindow(
          monitorId,
          startTime,
          endTime,
          window.description,
          window.timezone || 'UTC'
        );
      }
    }
  }
}
