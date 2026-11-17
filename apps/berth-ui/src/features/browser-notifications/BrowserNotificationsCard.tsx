import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BrowserNotifications } from '@/features/browser-notifications/browserNotifications';

export function BrowserNotificationsCard() {
  const [, refresh] = useState(0);
  const permission = BrowserNotifications.permission();
  const enabled = BrowserNotifications.enabled();

  const toggle = async (on: boolean) => {
    if (on && permission !== 'granted') {
      const result = await BrowserNotifications.request();
      if (result === 'granted') window.location.reload();
      refresh((value) => value + 1);
      return;
    }
    BrowserNotifications.setEnabled(on);
    refresh((value) => value + 1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" aria-hidden="true" />
          Browser notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {permission === 'unsupported' ? (
          <p className="text-muted-foreground text-sm">This browser does not support notifications.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <Label htmlFor="browser-notifications">Notify me in this browser</Label>
                <p className="text-muted-foreground max-w-xl text-sm">
                  Shows a notification when a build finishes, a deployment fails or a service
                  crashes while this tab is in the background.
                </p>
              </div>
              <Switch
                id="browser-notifications"
                checked={enabled}
                disabled={permission === 'denied'}
                onCheckedChange={(on) => void toggle(on)}
              />
            </div>
            {permission === 'denied' ? (
              <p className="text-destructive text-xs">
                Notifications are blocked for this site. Allow them in your browser&apos;s site
                settings, then reload.
              </p>
            ) : null}
            {enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void BrowserNotifications.show({
                    title: 'Berth notifications are on',
                    body: 'You will see build and crash alerts here.',
                    tag: 'berth-test',
                    url: '/',
                  })
                }
              >
                Send a test notification
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
