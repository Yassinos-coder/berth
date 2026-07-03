import { toast as sonner } from 'sonner';
import { AlertToast, type ToastLevel } from '@/components/shared/AlertToast';

interface NotifyOptions {
  description?: string;
  duration?: number;
}

function show(level: ToastLevel, title: string, options?: NotifyOptions) {
  return sonner.custom(
    (id) => (
      <AlertToast
        level={level}
        title={title}
        description={options?.description}
        onDismiss={() => sonner.dismiss(id)}
      />
    ),
    { duration: options?.duration ?? (level === 'error' ? 6000 : 4000) },
  );
}

export const notify = {
  info: (title: string, options?: NotifyOptions) =>
    show('info', title, options),
  warn: (title: string, options?: NotifyOptions) =>
    show('warn', title, options),
  error: (title: string, options?: NotifyOptions) =>
    show('error', title, options),
  success: (title: string, options?: NotifyOptions) =>
    show('success', title, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
