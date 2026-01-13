import axios from 'axios';
import https from 'https';
import tls from 'tls';
import type { ConditionContext } from '../condition-evaluator.js';


export interface CheckResult {
  success: boolean;
  responseTime: number;
  context: ConditionContext;
  error?: string;
}

/**
 * Get SSL certificate expiration for a given hostname
 * Returns days until expiration, or undefined if not HTTPS
 */
async function getCertificateExpiration(url: string): Promise<{ daysUntilExpiry: number; expiryDate: Date } | undefined> {
  if (!url.startsWith('https://')) {
    return undefined;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port ? parseInt(urlObj.port) : 443;

    return new Promise((resolve) => {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname, // SNI
          rejectUnauthorized: false, // We want to check even invalid certs
        },
        () => {
          const cert = socket.getPeerCertificate();
          socket.end();

          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            const now = new Date();
            const diffMs = expiryDate.getTime() - now.getTime();
            const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            resolve({ daysUntilExpiry, expiryDate });
          } else {
            resolve(undefined);
          }
        }
      );

      socket.on('error', () => {
        resolve(undefined);
      });

      // Timeout after 5 seconds
      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve(undefined);
      });
    });
  } catch {
    return undefined;
  }
}

/**
 * Format days until expiry as a string (e.g., "30d", "5d", "48h")
 */
function formatExpiration(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 1) {
    const hours = Math.max(0, Math.floor(daysUntilExpiry * 24));
    return `${hours}h`;
  }
  return `${daysUntilExpiry}d`;
}

export class HttpChecker {
  static async check(url: string, timeout: number = 30000): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      // Run HTTP request and certificate check in parallel
      const [response, certInfo] = await Promise.all([
        axios.get(url, {
          timeout,
          validateStatus: () => true, // Don't throw on any status code
          maxRedirects: 5,
        }),
        getCertificateExpiration(url),
      ]);

      const responseTime = Date.now() - startTime;

      const context: ConditionContext = {
        STATUS: response.status,
        RESPONSE_TIME: responseTime,
        CONNECTED: true,
        BODY: response.data,
        HEADERS: response.headers as Record<string, string>,
        CERTIFICATE_EXPIRATION: certInfo ? formatExpiration(certInfo.daysUntilExpiry) : undefined,
        CERTIFICATE_EXPIRY_DAYS: certInfo?.daysUntilExpiry,
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
