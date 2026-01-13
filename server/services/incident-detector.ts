import { CheckRepository } from '../repositories/check-repository.js';
import { IncidentRepository } from '../repositories/incident-repository.js';
import { MaintenanceRepository } from '../repositories/maintenance-repository.js';
import type { MonitorCheckResult } from '../monitors/runner.js';

// Number of consecutive failures required before creating an incident
const FAILURE_THRESHOLD = 2;

export class IncidentDetector {
  /**
   * Process a check result and update incident status
   */
  static async processCheckResult(result: MonitorCheckResult): Promise<void> {
    if (!result.monitorId) {
      console.warn('[IncidentDetector] No monitor ID in result, skipping');
      return;
    }

    // Save the check result first
    await CheckRepository.saveCheck(result);

    // Check if monitor is in maintenance window
    const maintenanceStatus = await MaintenanceRepository.isInMaintenance(result.monitorId);
    if (maintenanceStatus.inMaintenance) {
      console.log(`[IncidentDetector] Monitor ${result.monitorName} is in maintenance, skipping incident detection`);
      return;
    }

    // Get active incident for this monitor
    const activeIncident = await IncidentRepository.getActiveIncident(result.monitorId);

    if (result.success) {
      // Monitor is UP
      if (activeIncident) {
        // Resolve the incident
        await IncidentRepository.resolveIncident(activeIncident.id);
        console.log(`[IncidentDetector] Resolved incident #${activeIncident.id} for monitor ${result.monitorName}`);
        
        // TODO: Send recovery notification
      }
    } else {
      // Monitor is DOWN
      if (!activeIncident) {
        // Check if we've had enough consecutive failures before creating incident
        const consecutiveFailures = await this.getConsecutiveFailureCount(result.monitorId);
        
        if (consecutiveFailures >= FAILURE_THRESHOLD) {
          // Create a new incident
          const severity = this.determineSeverity(result);
          const incident = await IncidentRepository.createIncident(
            result.monitorId,
            result.monitorName,
            severity
          );
          
          console.log(`[IncidentDetector] Created incident #${incident.id} for monitor ${result.monitorName} after ${consecutiveFailures} consecutive failures`);
          
          // TODO: Send incident notification
        } else {
          console.log(`[IncidentDetector] Monitor ${result.monitorName} failed (${consecutiveFailures}/${FAILURE_THRESHOLD} failures before incident)`);
        }
      } else {
        console.log(`[IncidentDetector] Incident #${activeIncident.id} still active for monitor ${result.monitorName}`);
        
        // Could update incident status based on duration or other factors
        // For example, escalate from 'investigating' to 'identified' after N minutes
      }
    }
  }

  /**
   * Get the count of consecutive recent failures for a monitor
   */
  private static async getConsecutiveFailureCount(monitorId: number): Promise<number> {
    const recentChecks = await CheckRepository.getRecentChecks(monitorId, 10);
    
    // Count consecutive failures from the most recent
    let failures = 0;
    for (const check of recentChecks) {
      if (check.success) {
        break; // Stop at first successful check
      }
      failures++;
    }
    
    return failures;
  }

  /**
   * Determine incident severity based on check result
   */
  private static determineSeverity(
    result: MonitorCheckResult
  ): 'minor' | 'major' | 'critical' {
    // Simple heuristic - can be made more sophisticated
    // For example, could check response time, error type, etc.
    
    if (result.error?.includes('timeout') || result.error?.includes('ECONNREFUSED')) {
      return 'major';
    }
    
    if (result.error?.includes('DNS') || result.error?.includes('certificate')) {
      return 'critical';
    }
    
    return 'minor';
  }

  /**
   * Check if a monitor is flapping (alternating between up/down rapidly)
   * This helps prevent notification spam
   */
  static async isFlapping(monitorId: number, windowMinutes: number = 15): Promise<boolean> {
    const recentChecks = await CheckRepository.getRecentChecks(
      monitorId,
      20 // Check last 20 results
    );

    if (recentChecks.length < 10) {
      return false; // Not enough data
    }

    // Count state changes
    let stateChanges = 0;
    for (let i = 1; i < recentChecks.length; i++) {
      if (recentChecks[i].success !== recentChecks[i - 1].success) {
        stateChanges++;
      }
    }

    // If more than 5 state changes in recent checks, consider it flapping
    return stateChanges > 5;
  }
}
