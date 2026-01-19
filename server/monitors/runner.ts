import type { Monitor } from '../config/schemas/monitors.schema.js';
import { HttpChecker } from './checkers/http-checker.js';
import { TcpChecker } from './checkers/tcp-checker.js';
import { WebSocketChecker } from './checkers/websocket-checker.js';
import { DnsChecker } from './checkers/dns-checker.js';
import { PingChecker } from './checkers/ping-checker.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import type { CheckResult } from './checkers/http-checker.js';

export interface MonitorCheckResult {
  monitorId?: number;
  monitorName: string;
  success: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
  conditionResults: { condition: string; success: boolean }[];
}

export class MonitorRunner {
  static async runCheck(monitor: Monitor, monitorId?: number): Promise<MonitorCheckResult> {
    let checkResult: CheckResult;

    // Run the appropriate checker based on monitor type
    switch (monitor.type) {
      case 'http':
        checkResult = await HttpChecker.check(monitor.url);
        break;
      
      case 'tcp':
        checkResult = await TcpChecker.check(monitor.url);
        break;
      
      case 'websocket':
        checkResult = await WebSocketChecker.check(monitor.url);
        break;
      
      case 'dns':
        checkResult = await DnsChecker.check(monitor.url);
        break;
      
      case 'ping':
        checkResult = await PingChecker.check(monitor.url);
        break;
      
      default:
        checkResult = {
          success: false,
          responseTime: 0,
          context: { ERROR: `Unknown monitor type: ${monitor.type}`, TIMESTAMP: new Date().toISOString() },
          error: 'Unknown monitor type',
        };
    }

    // Evaluate conditions
    const conditionResults = ConditionEvaluator.evaluateAll(
      monitor.conditions,
      checkResult.context
    );

    // Check passes only if all conditions pass
    const allConditionsPass = conditionResults.every(r => r.success);

    return {
      monitorId,
      monitorName: monitor.name,
      success: checkResult.success && allConditionsPass,
      responseTime: checkResult.responseTime,
      timestamp: new Date(),
      error: checkResult.error,
      conditionResults,
    };
  }

  static async runChecks(monitors: Monitor[], concurrency: number = 20): Promise<MonitorCheckResult[]> {
    const results: MonitorCheckResult[] = [];
    const queue = [...monitors];
    const activePromises: Promise<void>[] = [];

    const runNext = async (): Promise<void> => {
      const monitor = queue.shift();
      if (!monitor) return;

      const result = await this.runCheck(monitor);
      results.push(result);

      if (queue.length > 0) {
        await runNext();
      }
    };

    // Start initial batch
    const initialBatchSize = Math.min(concurrency, monitors.length);
    for (let i = 0; i < initialBatchSize; i++) {
      activePromises.push(runNext());
    }

    await Promise.all(activePromises);
    
    // Sort results to match input order? Or just return as is (order usually doesn't matter for runner)
    // If order matters, we should map results to IDs or something.
    // The current implementation returns an array.
    // Let's ensure strict input order map if needed, but existing caller just maps over results.
    // Actually, callers might expect results to roughly correspond, but `runCheck` returns `monitorName` inside.
    // `api/status` relies on `monitorName` from result.
    // So order is not strictly required but good practice.
    // Let's keep it simple for now as the return type includes metadata.
    
    return results;
  }
}
