import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { ConfigLoader } from '../config/loader.js';
import { CheckRepository } from '../repositories/check-repository.js';
import { MonitorRepository } from '../repositories/monitor-repository.js';
import { StatusHistoryRepository } from '../repositories/status-history-repository.js';
import { MaintenanceRepository } from '../repositories/maintenance-repository.js';

// Mock ConfigLoader
vi.mock('../config/loader.js', () => ({
  ConfigLoader: {
    getMonitorsConfig: vi.fn(),
    getAppConfig: vi.fn(),
  },
}));

// Mock Repositories
vi.mock('../repositories/monitor-repository.js');
vi.mock('../repositories/check-repository.js');
vi.mock('../repositories/status-history-repository.js');
vi.mock('../repositories/maintenance-repository.js');

describe('API Tests', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/monitors', () => {
    it('fetches monitors efficiently using bulk methods', async () => {
      // Setup mock data
      const mockMonitors = [
        { id: 1, name: 'Monitor 1', type: 'http', url: 'http://1' },
        { id: 2, name: 'Monitor 2', type: 'http', url: 'http://2' },
      ];

      vi.mocked(ConfigLoader.getMonitorsConfig).mockReturnValue({
        monitors: mockMonitors as any,
      });

      vi.mocked(MonitorRepository.getPublicMonitorIds).mockResolvedValue(new Set([1, 2]));
      
      // Mock bulk returns
      vi.mocked(CheckRepository.getUptimeForMonitors).mockResolvedValue(new Map([[1, 99], [2, 98]]));
      vi.mocked(CheckRepository.getAverageResponseTimeForMonitors).mockResolvedValue(new Map([[1, 100], [2, 200]]));
      vi.mocked(CheckRepository.getLatestChecksForMonitors).mockResolvedValue(new Map([
        [1, { success: true, response_time_ms: 100, checked_at: new Date() }],
        [2, { success: false, response_time_ms: 0, checked_at: new Date() }],
      ]));
      vi.mocked(MaintenanceRepository.getMaintenanceStatusForMonitors).mockResolvedValue(new Map([
        [1, { inMaintenance: false }],
        [2, { inMaintenance: false }],
      ]));
      vi.mocked(StatusHistoryRepository.getHistory).mockResolvedValue([]);

      const res = await request(app).get('/api/monitors');

      expect(res.status).toBe(200);
      expect(res.body.monitors).toHaveLength(2);
      
      const mon1 = res.body.monitors.find((m: any) => m.id === 1);
      const mon2 = res.body.monitors.find((m: any) => m.id === 2);

      expect(mon1.uptime).toBe(99);
      expect(mon2.uptime).toBe(98);
      expect(mon1.currentStatus).toBe('up');
      expect(mon2.currentStatus).toBe('down');

      // Verify bulk methods were called exactly once with correct IDs
      expect(CheckRepository.getUptimeForMonitors).toHaveBeenCalledTimes(1);
      expect(CheckRepository.getUptimeForMonitors).toHaveBeenCalledWith([1, 2], 90);
    });

    it('filters out private monitors', async () => {
      const mockMonitors = [
        { id: 1, name: 'Public', type: 'http' },
        { id: 2, name: 'Private', type: 'http' },
      ];

      vi.mocked(ConfigLoader.getMonitorsConfig).mockReturnValue({
        monitors: mockMonitors as any,
      });

      vi.mocked(MonitorRepository.getPublicMonitorIds).mockResolvedValue(new Set([1]));
       // Mock empty returns for simplicity
      vi.mocked(CheckRepository.getUptimeForMonitors).mockResolvedValue(new Map());
      vi.mocked(CheckRepository.getAverageResponseTimeForMonitors).mockResolvedValue(new Map());
      vi.mocked(CheckRepository.getLatestChecksForMonitors).mockResolvedValue(new Map());
      vi.mocked(MaintenanceRepository.getMaintenanceStatusForMonitors).mockResolvedValue(new Map());
      vi.mocked(StatusHistoryRepository.getHistory).mockResolvedValue([]);

      const res = await request(app).get('/api/monitors');

      expect(res.status).toBe(200);
      expect(res.body.monitors).toHaveLength(1);
      expect(res.body.monitors[0].name).toBe('Public');
      
      // Verify bulk call only included public ID
      expect(CheckRepository.getUptimeForMonitors).toHaveBeenCalledWith([1], 90);
    });
  });
});
