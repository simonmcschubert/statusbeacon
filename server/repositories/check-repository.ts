import pool from '../db/index.js';
import type { MonitorCheckResult } from '../monitors/runner.js';

export class CheckRepository {
  /**
   * Save a check result to the database
   */
  static async saveCheck(result: MonitorCheckResult): Promise<number> {
    const client = await pool.connect();
    
    try {
      const query = `
        INSERT INTO checks (
          monitor_id,
          success,
          response_time_ms,
          error_message,
          checked_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const values = [
        result.monitorId,
        result.success,
        result.responseTime,
        result.error || null,
        result.timestamp,
      ];
      
      const res = await client.query(query, values);
      return res.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Get recent checks for a monitor
   */
  static async getRecentChecks(
    monitorId: number,
    limit: number = 100
  ): Promise<any[]> {
    const query = `
      SELECT 
        id,
        success,
        response_time_ms,
        error_message,
        checked_at
      FROM checks
      WHERE monitor_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [monitorId, limit]);
    return result.rows;
  }

  /**
   * Calculate uptime percentage for a monitor
   */
  static async calculateUptime(
    monitorId: number,
    periodDays: number = 30
  ): Promise<number> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE success = true) as successful_checks,
        COUNT(*) as total_checks
      FROM checks
      WHERE 
        monitor_id = $1
        AND checked_at > NOW() - INTERVAL '${periodDays} days'
    `;
    
    const result = await pool.query(query, [monitorId]);
    const { successful_checks, total_checks } = result.rows[0];
    
    if (total_checks === 0) return 100;
    
    return (successful_checks / total_checks) * 100;
  }

  /**
   * Get average response time for a monitor
   */
  static async getAverageResponseTime(
    monitorId: number,
    periodDays: number = 30
  ): Promise<number> {
    const query = `
      SELECT AVG(response_time_ms) as avg_response_time
      FROM checks
      WHERE 
        monitor_id = $1
        AND success = true
        AND checked_at > NOW() - INTERVAL '${periodDays} days'
    `;
    
    const result = await pool.query(query, [monitorId]);
    return result.rows[0].avg_response_time || 0;
  }

  /**
   * Get the latest check for a monitor
   */
  static async getLatestCheck(
    monitorId: number
  ): Promise<{ success: boolean; response_time_ms: number; checked_at: Date } | null> {
    const query = `
      SELECT success, response_time_ms, checked_at
      FROM checks
      WHERE monitor_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [monitorId]);
    return result.rows[0] || null;
  }
}
