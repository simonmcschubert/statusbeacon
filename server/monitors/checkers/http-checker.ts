import axios from 'axios';
import type { ConditionContext } from '../condition-evaluator.js';


export interface CheckResult {
  success: boolean;
  responseTime: number;
  context: ConditionContext;
  error?: string;
}

export class HttpChecker {
  static async check(url: string, timeout: number = 30000): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        timeout,
        validateStatus: () => true, // Don't throw on any status code
        maxRedirects: 5,
      });

      const responseTime = Date.now() - startTime;

      // Parse certificate expiration if HTTPS
      let certificateExpiration: string | undefined;
      if (url.startsWith('https://')) {
        // Certificate info would need to be extracted from the TLS connection
        // For now, we'll leave this for future enhancement
      }

      const context: ConditionContext = {
        STATUS: response.status,
        RESPONSE_TIME: responseTime,
        CONNECTED: true,
        BODY: response.data,
        HEADERS: response.headers as Record<string, string>,
        CERTIFICATE_EXPIRATION: certificateExpiration,
        TIMESTAMP: new Date().toISOString(),
      };

      return {
        success: response.status >= 200 && response.status < 300,
        responseTime,
        context,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        responseTime,
        context: {
          CONNECTED: false,
          ERROR: errorMessage,
          TIMESTAMP: new Date().toISOString(),
        },
        error: errorMessage,
      };
    }
  }
}
