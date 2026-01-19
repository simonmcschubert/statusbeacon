import pool from '../db/index.js';
import { CheckRepository } from './check-repository.js';

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
        (COUNT(*) FILTER (WHERE status = 'up')::float / NULLIF(COUNT(*)::float, 0) * 100) as uptime_percentage,
        ROUND(AVG(response_time_ms) FILTER (WHERE status = 'up'))::integer as avg_response_time_ms,
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE status = 'up') as successful_checks
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
   * Calculate average uptime from status_history
   * More accurate than recalculating from checks for historical data
   */
  static async calculateAverageUptime(
    monitorId: number,
    days: number = 90
  ): Promise<number> {
    const query = `
      SELECT AVG(uptime_percentage) as avg_uptime
      FROM status_history
      WHERE 
        monitor_id = $1
        AND date > CURRENT_DATE - INTERVAL '${days} days'
    `;
    
    const result = await pool.query(query, [monitorId]);
    const avgUptime = result.rows[0]?.avg_uptime;
    
    // If no history data, fall back to 100%
    return avgUptime !== null ? parseFloat(avgUptime) : 100;
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
    
    // Get yesterday's date string from DB to ensure timezone consistency
    const dateRes = await pool.query("SELECT (CURRENT_DATE - 1)::text as date");
    const dateStr = dateRes.rows[0].date;
    
    for (const row of result.rows) {
      await this.aggregateDailyStatus(row.monitor_id, dateStr);
    }
  }

  /**
   * Backfill historical data for all monitors for the past N days
   */
  static async backfillHistory(days: number = 90): Promise<number> {
    let aggregatedCount = 0;
    
    // Get all unique monitor IDs and dates that have checks but no history
    const query = `
      SELECT DISTINCT c.monitor_id, DATE(c.checked_at)::text as check_date
      FROM checks c
      LEFT JOIN status_history sh 
        ON c.monitor_id = sh.monitor_id 
        AND DATE(c.checked_at) = sh.date
      WHERE 
        c.checked_at > CURRENT_DATE - INTERVAL '${days} days'
        AND sh.id IS NULL
      ORDER BY check_date
    `;
    
    const result = await pool.query(query);
    
    for (const row of result.rows) {
      const dateStr = row.check_date;
      await this.aggregateDailyStatus(row.monitor_id, dateStr);
      aggregatedCount++;
    }
    
    return aggregatedCount;
  }

  /**
   * Aggregate today's data (for real-time updates)
   */
  static async aggregateToday(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const monitorsQuery = `
      SELECT DISTINCT monitor_id
      FROM checks
      WHERE DATE(checked_at) = CURRENT_DATE
    `;
    
    const result = await pool.query(monitorsQuery);
    
    for (const row of result.rows) {
      await this.aggregateDailyStatus(row.monitor_id, today);
    }
  }

  /**
   * Get history with automatic fallback to raw checks for missing/stale data
   * Merges cached status_history with raw checks data
   */
  static async getHistoryWithFallback(
    monitorId: number,
    days: number = 90
  ): Promise<{ date: string; uptime: number }[]> {
    // 1. Get cached history
    const cachedHistory = await this.getHistory(monitorId, days);
    
    // 2. Get raw history from checks (for fallback/filling gaps)
    // We fetch this regardless for now to ensure we have the latest data, 
    // especially since status_history might be stale (e.g. cron failed)
    const rawHistory = await CheckRepository.getDailyUptimeHistory(monitorId, days);
    
    // 3. Merge them using a Map (raw data takes precedence as it's the source of truth)
    const historyMap = new Map<string, number>();
    
    // Populate with cached data first
    cachedHistory.forEach(h => {
        historyMap.set(h.date, h.uptimePercentage);
    });
    
    // Override/append with raw data (which is always fresh)
    rawHistory.forEach(h => {
        historyMap.set(h.date, h.uptime);
    });
    
    // 4. Convert back to sorted array
    return Array.from(historyMap.entries())
        .map(([date, uptime]) => ({ date, uptime }))
        .sort((a, b) => b.date.localeCompare(a.date));
  }
}
