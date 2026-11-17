import { useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/toast';
import { BrowserNotifications } from '@/features/browser-notifications/browserNotifications';

export function NotificationPrompt() {
  const [visible, setVisible] = useState(() => BrowserNotifications.shouldPrompt());
  const [asking, setAsking] = useState(false);
  if (!visible) return null;

  const enable = async () => {
    setAsking(true);
    const result = await BrowserNotifications.request();
    setAsking(false);
    if (result === 'granted') {
      window.location.reload();
      return;
    }
    setVisible(false);
    if (result === 'denied') {
      notify.error('Notifications are blocked', {
        description: 'Allow them for this site in your browser settings, then try again from Settings.',
      });
    }
  };

  const later = () => {
    BrowserNotifications.dismissPrompt();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Browser notifications"
      className="bg-primary/10 border-primary/30 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <Bell className="text-primary size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-48 flex-1">
        Get a browser notification when a build finishes, a deployment fails or a service crashes,
        even when this tab is in the background.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void enable()} disabled={asking}>
          {asking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Enable notifications
        </Button>
        <Button size="sm" variant="ghost" onClick={later} aria-label="Not now">
          <X className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Not now</span>
        </Button>
      </div>
    </div>
  );
}
