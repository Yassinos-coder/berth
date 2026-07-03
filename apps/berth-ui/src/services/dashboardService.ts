import { BaseApiClient } from '@/services/baseApiClient';
import type { ActivityItem, DashboardStats } from '@/interfaces';

class DashboardService extends BaseApiClient {
  protected resource = 'dashboard';

  stats(): Promise<DashboardStats> {
    return this.get<DashboardStats>('/stats');
  }

  activity(): Promise<ActivityItem[]> {
    return this.get<ActivityItem[]>('/activity');
  }
}

export const dashboardService = new DashboardService();
