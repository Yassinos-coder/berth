import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  dashboardStats: ['dashboard', 'stats'] as const,
  dashboardActivity: ['dashboard', 'activity'] as const,
  servers: ['servers'] as const,
  server: (id: string) => ['servers', id] as const,
  services: ['services'] as const,
  service: (id: string) => ['services', id] as const,
  serviceLogs: (id: string) => ['services', id, 'logs'] as const,
  serviceMetrics: (id: string) => ['services', id, 'metrics'] as const,
  deployments: ['deployments'] as const,
  serviceDeployments: (id: string) => ['deployments', 'service', id] as const,
  templates: ['templates'] as const,
  team: ['team'] as const,
};
