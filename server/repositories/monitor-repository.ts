import pool from '../db/index.js';
import type { Monitor } from '../config/schemas/monitors.schema.js';
import { MaintenanceRepository } from './maintenance-repository.js';

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
      for (const monitor of monitors) {
        await client.query(`
          INSERT INTO monitors (id, name, "group", type, url, public)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            "group" = EXCLUDED."group",
            type = EXCLUDED.type,
            url = EXCLUDED.url,
            public = EXCLUDED.public,
            updated_at = NOW()
        `, [
          monitor.id,
          monitor.name,
          monitor.group || null,
          monitor.type,
          monitor.url,
          monitor.public ?? true,
        ]);

        // Sync maintenance windows for this monitor
        if (monitor.maintenance && monitor.maintenance.length > 0) {
          const validWindows = monitor.maintenance.filter(
            (m): m is { start: string; end: string; timezone?: string; description?: string } => 
              typeof m.start === 'string' && typeof m.end === 'string'
          );
          if (validWindows.length > 0) {
            await MaintenanceRepository.syncFromConfig(monitor.id, validWindows);
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
}
