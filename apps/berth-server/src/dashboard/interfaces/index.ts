export interface DashboardStatsDto {
  servers: number;
  serversOnline: number;
  services: number;
  servicesRunning: number;
  deploymentsToday: number;
  avgCpuPct: number;
  avgMemPct: number;
}
