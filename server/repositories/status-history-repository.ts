import { pool } from '../db/index.js';

export interface StatusHistoryEntry {
  id: number;
  monitorId: number;
  date: string;
  uptimePercentage: number;
  avgResponseTimeMs: number;
  totalChecks: number;
  successfulChecks: number;
}

export class StatusHistoryRepository {
  /**
   * Aggregate daily status for a monitor
   * This should be run once per day for each monitor
   */
  static async aggregateDailyStatus(
    monitorId: number,
    date: string // YYYY-MM-DD format
  ): Promise<void> {
    const query = `
      INSERT INTO status_history (
        monitor_id,
        date,
        uptime_percentage,
        avg_response_time_ms,
        total_checks,
        successful_checks
      )
      SELECT 
        $1 as monitor_id,
        $2::date as date,
        (COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)::float * 100) as uptime_percentage,
        AVG(response_time_ms) FILTER (WHERE success = true) as avg_response_time_ms,
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE success = true) as successful_checks
      FROM checks
      WHERE 
        monitor_id = $1
        AND DATE(checked_at) = $2::date
      ON CONFLICT (monitor_id, date) 
      DO UPDATE SET
        uptime_percentage = EXCLUDED.uptime_percentage,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        total_checks = EXCLUDED.total_checks,
        successful_checks = EXCLUDED.successful_checks
    `;
    
    await pool.query(query, [monitorId, date]);
  }

  /**
   * Get status history for a monitor
   */
  static async getHistory(
    monitorId: number,
    days: number = 90
  ): Promise<StatusHistoryEntry[]> {
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        date::text,
        uptime_percentage as "uptimePercentage",
        avg_response_time_ms as "avgResponseTimeMs",
        total_checks as "totalChecks",
        successful_checks as "successfulChecks"
      FROM status_history
      WHERE 
        monitor_id = $1
        AND date > CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;
    
    const result = await pool.query(query, [monitorId]);
    return result.rows;
  }

  /**
   * Aggregate all monitors for yesterday
   * Run this as a daily cron job
   */
  static async aggregateAllYesterday(): Promise<void> {
    // Get all unique monitor IDs from checks table
    const monitorsQuery = `
      SELECT DISTINCT monitor_id
      FROM checks
      WHERE DATE(checked_at) = CURRENT_DATE - 1
    `;
    
    const result = await pool.query(monitorsQuery);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    for (const row of result.rows) {
      await this.aggregateDailyStatus(row.monitor_id, dateStr);
    }
  }
}
