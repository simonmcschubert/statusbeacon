import pool from '../db/index.js';
import type { Monitor } from '../config/schemas/monitors.schema.js';
import { MaintenanceRepository, type RecurringMaintenanceConfig } from './maintenance-repository.js';

export interface CreateMonitorInput {
  name: string;
  type: string;
  url: string;
  group?: string;
  public?: boolean;
  config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
}

export interface UpdateMonitorInput {
  name?: string;
  type?: string;
  url?: string;
  group?: string;
  public?: boolean;
  config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
}

export class MonitorRepository {
  /**
   * Sync monitors from config to database
   * This ensures the database always matches the monitors.yml config
   */
  static async syncMonitors(monitors: Monitor[]): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get existing monitor IDs from database
      const existingResult = await client.query('SELECT id FROM monitors');
      const existingIds = new Set<number>(existingResult.rows.map(r => r.id as number));
      
      // Get config monitor IDs
      const configIds = new Set<number>(monitors.map(m => m.id));
      
      // Upsert all monitors from config
      // Note: We don't overwrite 'public' on conflict - database is the source of truth for visibility
      for (const monitor of monitors) {
        await client.query(`
          INSERT INTO monitors (id, name, "group", type, url, public)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            "group" = EXCLUDED."group",
            type = EXCLUDED.type,
            url = EXCLUDED.url,
            updated_at = NOW()
        `, [
          monitor.id,
          monitor.name,
          monitor.group || null,
          monitor.type,
          monitor.url,
          monitor.public ?? true,
        ]);

        // Process maintenance windows
        if (monitor.maintenance && monitor.maintenance.length > 0) {
          // Separate one-time and recurring maintenance windows
          const oneTimeWindows: { start: string; end: string; timezone?: string; description?: string }[] = [];
          const recurringWindows: RecurringMaintenanceConfig[] = [];
          
          for (const m of monitor.maintenance) {
            if ('type' in m && m.type === 'daily') {
              recurringWindows.push(m as RecurringMaintenanceConfig);
            } else if ('start' in m && 'end' in m) {
              oneTimeWindows.push(m as { start: string; end: string; timezone?: string; description?: string });
            }
          }
          
          // Sync one-time windows to database
          if (oneTimeWindows.length > 0) {
            await MaintenanceRepository.syncFromConfig(monitor.id, oneTimeWindows);
          }
          
          // Cache recurring windows in memory
          if (recurringWindows.length > 0) {
            MaintenanceRepository.setRecurringMaintenance(monitor.id, recurringWindows);
            console.log(`[MonitorSync] Cached ${recurringWindows.length} recurring maintenance windows for monitor ${monitor.name}`);
          }
        }
      }
      
      // Delete monitors that are no longer in config
      for (const existingId of existingIds) {
        if (!configIds.has(existingId)) {
          await client.query('DELETE FROM monitors WHERE id = $1', [existingId]);
          console.log(`[MonitorSync] Deleted monitor id=${existingId} (no longer in config)`);
        }
      }
      
      await client.query('COMMIT');
      console.log(`[MonitorSync] Synced ${monitors.length} monitors to database`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all monitors from database
   */
  static async getAllMonitors(): Promise<Monitor[]> {
    const result = await pool.query(`
      SELECT id, name, "group", type, url, public
      FROM monitors
      ORDER BY id
    `);
    return result.rows;
  }

  /**
   * Get a single monitor by ID
   */
  static async getMonitorById(id: number): Promise<Monitor | null> {
    const result = await pool.query(
      'SELECT id, name, "group", type, url, public FROM monitors WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get public status for a monitor from database
   * Database is the source of truth for visibility settings
   */
  static async isPublic(id: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT public FROM monitors WHERE id = $1',
      [id]
    );
    // Default to true if not found
    return result.rows[0]?.public ?? true;
  }

  /**
   * Get all public monitor IDs from database
   */
  static async getPublicMonitorIds(): Promise<Set<number>> {
    const result = await pool.query(
      'SELECT id FROM monitors WHERE public = true'
    );
    return new Set(result.rows.map(r => r.id));
  }

  /**
   * Create a new monitor
   */
  static async create(monitor: CreateMonitorInput): Promise<Monitor> {
    const result = await pool.query(
      `INSERT INTO monitors (name, type, url, "group", public, config, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, "group", type, url, public, config, conditions`,
      [
        monitor.name,
        monitor.type,
        monitor.url,
        monitor.group || null,
        monitor.public ?? true,
        monitor.config ? JSON.stringify(monitor.config) : null,
        monitor.conditions ? JSON.stringify(monitor.conditions) : null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update a monitor
   */
  static async update(id: number, updates: UpdateMonitorInput): Promise<Monitor | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(updates.type);
    }
    if (updates.url !== undefined) {
      fields.push(`url = $${paramIndex++}`);
      values.push(updates.url);
    }
    if (updates.group !== undefined) {
      fields.push(`"group" = $${paramIndex++}`);
      values.push(updates.group || null);
    }
    if (updates.public !== undefined) {
      fields.push(`public = $${paramIndex++}`);
      values.push(updates.public);
    }
    if (updates.config !== undefined) {
      fields.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.config));
    }
    if (updates.conditions !== undefined) {
      fields.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.conditions));
    }

    if (fields.length === 0) {
      return this.getMonitorById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE monitors SET ${fields.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, name, "group", type, url, public, config, conditions`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a monitor
   */
  static async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM monitors WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count all monitors
   */
  static async count(): Promise<number> {
    const result = await pool.query('SELECT COUNT(*) FROM monitors');
    return parseInt(result.rows[0].count, 10);
  }
}
