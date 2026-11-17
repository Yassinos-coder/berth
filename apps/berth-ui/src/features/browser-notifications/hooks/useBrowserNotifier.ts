import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deploymentsService } from '@/services/deploymentsService';
import { queryKeys } from '@/lib/queryClient';
import { useServices } from '@/hooks/useServicesQueries';
import { BrowserNotifications } from '@/features/browser-notifications/browserNotifications';
import {
  NotificationEvents,
  type NotifierSnapshot,
} from '@/features/browser-notifications/notificationEvents';

const POLL_MS = 8000;

export function useBrowserNotifier() {
  const active = BrowserNotifications.enabled();
  const deployments = useQuery({
    queryKey: queryKeys.deployments,
    queryFn: () => deploymentsService.list(),
    enabled: active,
    refetchInterval: active ? POLL_MS : false,
  });
  const services = useServices();
  const previous = useRef<NotifierSnapshot | null>(null);

  useEffect(() => {
    if (!active || !deployments.data || !services.data) return;
    const before = previous.current;
    previous.current = NotificationEvents.snapshot(deployments.data, services.data);
    if (!before || !BrowserNotifications.userIsAway()) return;
    for (const notice of NotificationEvents.diff(before, deployments.data, services.data)) {
      void BrowserNotifications.show(notice);
    }
  }, [active, deployments.data, services.data]);
}
