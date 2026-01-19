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
          status,
          response_time_ms,
          error_message,
          checked_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const values = [
        result.monitorId,
        result.success ? 'up' : 'down',
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
        status = 'up' as success,
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
        COUNT(*) FILTER (WHERE status = 'up') as successful_checks,
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
        AND status = 'up'
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
      SELECT status = 'up' as success, response_time_ms, checked_at
      FROM checks
      WHERE monitor_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [monitorId]);
    return result.rows[0] || null;
  }

  /**
   * Get response time history for a monitor (aggregated by hour or day)
   */
  static async getResponseTimeHistory(
    monitorId: number,
    periodDays: number = 30,
    granularity: 'hour' | 'day' = 'day'
  ): Promise<{ timestamp: string; avgResponseTime: number; minResponseTime: number; maxResponseTime: number }[]> {
    const truncate = granularity === 'hour' ? 'hour' : 'day';
    const query = `
      SELECT 
        DATE_TRUNC('${truncate}', checked_at) as timestamp,
        AVG(response_time_ms)::numeric(10,2) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time
      FROM checks
      WHERE 
        monitor_id = $1
        AND status = 'up'
        AND checked_at > NOW() - INTERVAL '${periodDays} days'
      GROUP BY DATE_TRUNC('${truncate}', checked_at)
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [monitorId]);
    return result.rows.map(row => ({
      timestamp: row.timestamp.toISOString(),
      avgResponseTime: parseFloat(row.avg_response_time),
      minResponseTime: row.min_response_time,
      maxResponseTime: row.max_response_time,
    }));
  }

  /**
   * Get recent check results with response times
   */
  static async getRecentResponseTimes(
    monitorId: number,
    limit: number = 100
  ): Promise<{ timestamp: string; responseTime: number; success: boolean }[]> {
    const query = `
      SELECT checked_at, response_time_ms, status = 'up' as success
      FROM checks
      WHERE monitor_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [monitorId, limit]);
    return result.rows.map(row => ({
      timestamp: row.checked_at.toISOString(),
      responseTime: row.response_time_ms,
      success: row.success,
    })).reverse(); // Return in chronological order
  }


  /**
   * Delete checks older than the specified number of days
   * Used for data retention cleanup
   */
  static async deleteOldChecks(retentionDays: number): Promise<number> {
    const query = `
      DELETE FROM checks
      WHERE checked_at < NOW() - INTERVAL '1 day' * $1
    `;

    const result = await pool.query(query, [retentionDays]);
    return result.rowCount ?? 0;
  }

  /**
   * Count state transitions (up/down changes) in a time window
   * Used for flapping detection
   */
  static async getStateTransitionsInWindow(
    monitorId: number,
    windowMinutes: number
  ): Promise<number> {
    const query = `
      WITH ordered_checks AS (
        SELECT 
          status,
          LAG(status) OVER (ORDER BY checked_at) as prev_status
        FROM checks
        WHERE 
          monitor_id = $1
          AND checked_at > NOW() - INTERVAL '1 minute' * $2
        ORDER BY checked_at
      )
      SELECT COUNT(*) as transitions
      FROM ordered_checks
      WHERE status != prev_status AND prev_status IS NOT NULL
    `;

    const result = await pool.query(query, [monitorId, windowMinutes]);
    return parseInt(result.rows[0]?.transitions ?? '0', 10);
  }

  /**
   * Get latest checks for multiple monitors
   */
  static async getLatestChecksForMonitors(
    monitorIds: number[]
  ): Promise<Map<number, { success: boolean; response_time_ms: number; checked_at: Date }>> {
    if (monitorIds.length === 0) return new Map();

    // Use DISTINCT ON to get the latest check for each monitor
    const query = `
      SELECT DISTINCT ON (monitor_id)
        monitor_id,
        status = 'up' as success,
        response_time_ms,
        checked_at
      FROM checks
      WHERE monitor_id = ANY($1)
      ORDER BY monitor_id, checked_at DESC
    `;

    const result = await pool.query(query, [monitorIds]);

    const map = new Map();
    for (const row of result.rows) {
      map.set(row.monitor_id, {
        success: row.success,
        response_time_ms: row.response_time_ms,
        checked_at: row.checked_at
      });
    }

    return map;
  }

  /**
   * Calculate uptime for multiple monitors
   */
  static async getUptimeForMonitors(
    monitorIds: number[],
    periodDays: number = 30
  ): Promise<Map<number, number>> {
    if (monitorIds.length === 0) return new Map();

    const query = `
      SELECT 
        monitor_id,
        COUNT(*) FILTER (WHERE status = 'up') as successful_checks,
        COUNT(*) as total_checks
      FROM checks
      WHERE 
        monitor_id = ANY($1)
        AND checked_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY monitor_id
    `;

    const result = await pool.query(query, [monitorIds, periodDays]);

    const map = new Map();
    // Initialize all with default 100% or 0%
    for (const id of monitorIds) {
      map.set(id, 100);
    }

    for (const row of result.rows) {
      const total = parseInt(row.total_checks);
      const successful = parseInt(row.successful_checks);
      const uptime = total === 0 ? 100 : (successful / total) * 100;
      map.set(row.monitor_id, uptime);
    }

    return map;
  }

  /**
   * Get average response time for multiple monitors
   */
  static async getAverageResponseTimeForMonitors(
    monitorIds: number[],
    periodDays: number = 30
  ): Promise<Map<number, number>> {
    if (monitorIds.length === 0) return new Map();

    const query = `
      SELECT 
        monitor_id,
        AVG(response_time_ms) as avg_response_time
      FROM checks
      WHERE 
        monitor_id = ANY($1)
        AND status = 'up'
        AND checked_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY monitor_id
    `;

    const result = await pool.query(query, [monitorIds, periodDays]);

    const map = new Map();
    for (const id of monitorIds) {
      map.set(id, 0);
    }

    for (const row of result.rows) {
      map.set(row.monitor_id, parseFloat(row.avg_response_time) || 0);
    }

    return map;
  }
  /**
   * Get uptime for multiple monitors for a specific date (e.g. today)
   */
  static async getDailyUptimeForMonitors(
    monitorIds: number[],
    date: Date = new Date()
  ): Promise<Map<number, number>> {
    if (monitorIds.length === 0) return new Map();

    const dateStr = date.toISOString().split('T')[0];

    const query = `
      SELECT 
        monitor_id,
        COUNT(*) FILTER (WHERE status = 'up') as successful_checks,
        COUNT(*) as total_checks
      FROM checks
      WHERE 
        monitor_id = ANY($1)
        AND DATE(checked_at) = $2::date
      GROUP BY monitor_id
    `;

    const result = await pool.query(query, [monitorIds, dateStr]);

    const map = new Map();
    
    for (const row of result.rows) {
      const total = parseInt(row.total_checks);
      const successful = parseInt(row.successful_checks);
      // If checks exist, calculate uptime. Otherwise don't set in map (will be treated as no data)
      if (total > 0) {
        const uptime = (successful / total) * 100;
        map.set(row.monitor_id, uptime);
      }
    }

    return map;
  }

  /**
   * Get daily uptime history directly from checks table
   * Used as a fallback when status_history is missing
   */
  static async getDailyUptimeHistory(
    monitorId: number,
    days: number = 90
  ): Promise<{ date: string; uptime: number }[]> {
    const query = `
      SELECT 
        DATE(checked_at)::text as date,
        COUNT(*) FILTER (WHERE status = 'up') as successful_checks,
        COUNT(*) as total_checks
      FROM checks
      WHERE 
        monitor_id = $1
        AND checked_at > CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(checked_at)
      ORDER BY date DESC
    `;

    const result = await pool.query(query, [monitorId]);

    return result.rows.map(row => {
      const total = parseInt(row.total_checks);
      const successful = parseInt(row.successful_checks);
      return {
        date: row.date,
        uptime: total === 0 ? 0 : (successful / total) * 100
      };
    });
  }
}
