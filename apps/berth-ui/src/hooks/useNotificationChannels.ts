import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  notificationChannelsService,
  type CreateNotificationChannelPayload,
} from '@/services/notificationChannelsService';
import { notify } from '@/lib/toast';

const NOTIFICATION_CHANNELS_KEY = ['notification-channels'];

export function useNotificationChannels() {
  return useQuery({
    queryKey: NOTIFICATION_CHANNELS_KEY,
    queryFn: () => notificationChannelsService.list(),
  });
}

export function useCreateNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNotificationChannelPayload) =>
      notificationChannelsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATION_CHANNELS_KEY });
      notify.success('Notification channel added');
    },
    onError: (error) =>
      notify.error('Could not add notification channel', {
        description: error.message,
      }),
  });
}

export function useSetNotificationChannelEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      notificationChannelsService.setEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATION_CHANNELS_KEY }),
    onError: (error) =>
      notify.error('Could not update channel', { description: error.message }),
  });
}

export function useRemoveNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationChannelsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATION_CHANNELS_KEY });
      notify.success('Notification channel removed');
    },
    onError: (error) =>
      notify.error('Could not remove notification channel', {
        description: error.message,
      }),
  });
}
