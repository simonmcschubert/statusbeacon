import { pool } from '../db/index.js';

export interface Incident {
  id: number;
  monitorId: number;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  title: string;
  description?: string;
  startedAt: Date;
  resolvedAt?: Date;
}

export class IncidentRepository {
  /**
   * Create a new incident
   */
  static async createIncident(
    monitorId: number,
    monitorName: string,
    severity: 'minor' | 'major' | 'critical' = 'major'
  ): Promise<Incident> {
    const query = `
      INSERT INTO incidents (
        monitor_id,
        status,
        severity,
        title,
        started_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING 
        id,
        monitor_id as "monitorId",
        status,
        severity,
        title,
        description,
        started_at as "startedAt",
        resolved_at as "resolvedAt"
    `;
    
    const title = `${monitorName} is down`;
    const values = [monitorId, 'investigating', severity, title];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get active incident for a monitor
   */
  static async getActiveIncident(monitorId: number): Promise<Incident | null> {
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        status,
        severity,
        title,
        description,
        started_at as "startedAt",
        resolved_at as "resolvedAt"
      FROM incidents
      WHERE 
        monitor_id = $1
        AND resolved_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [monitorId]);
    return result.rows[0] || null;
  }

  /**
   * Resolve an incident
   */
  static async resolveIncident(incidentId: number): Promise<void> {
    const query = `
      UPDATE incidents
      SET 
        status = 'resolved',
        resolved_at = NOW()
      WHERE id = $1
    `;
    
    await pool.query(query, [incidentId]);
  }

  /**
   * Update incident status
   */
  static async updateIncidentStatus(
    incidentId: number,
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  ): Promise<void> {
    const query = `
      UPDATE incidents
      SET status = $1
      WHERE id = $2
    `;
    
    await pool.query(query, [status, incidentId]);
  }

  /**
   * Get all incidents (active and resolved)
   */
  static async getAllIncidents(limit: number = 50): Promise<Incident[]> {
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        status,
        severity,
        title,
        description,
        started_at as "startedAt",
        resolved_at as "resolvedAt"
      FROM incidents
      ORDER BY started_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * Get active incidents only
   */
  static async getActiveIncidents(): Promise<Incident[]> {
    const query = `
      SELECT 
        id,
        monitor_id as "monitorId",
        status,
        severity,
        title,
        description,
        started_at as "startedAt",
        resolved_at as "resolvedAt"
      FROM incidents
      WHERE resolved_at IS NULL
      ORDER BY started_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }
}
