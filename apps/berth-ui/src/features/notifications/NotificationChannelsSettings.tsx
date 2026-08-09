import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useCreateNotificationChannel,
  useNotificationChannels,
  useRemoveNotificationChannel,
  useSetNotificationChannelEnabled,
} from '@/hooks/useNotificationChannels';
import type { NotificationChannelKind } from '@/interfaces';

const KIND_LABEL: Record<NotificationChannelKind, string> = {
  slack: 'Slack',
  discord: 'Discord',
  webhook: 'Webhook',
  email: 'Email',
};

function AddChannelDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<NotificationChannelKind>('slack');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const create = useCreateNotificationChannel();

  const reset = () => {
    setName('');
    setWebhookUrl('');
    setWebhookSecret('');
    setSmtpHost('');
    setSmtpPort('587');
    setSmtpUser('');
    setSmtpPassword('');
    setEmailFrom('');
    setEmailTo('');
  };

  const isWebhookKind = kind === 'slack' || kind === 'discord' || kind === 'webhook';
  const canSubmit = name.trim() && (isWebhookKind ? webhookUrl.trim() : smtpHost.trim() && emailTo.trim());

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      {
        name: name.trim(),
        kind,
        ...(isWebhookKind
          ? {
              webhookUrl: webhookUrl.trim(),
              webhookSecret: kind === 'webhook' ? webhookSecret || undefined : undefined,
            }
          : {
              smtpHost: smtpHost.trim(),
              smtpPort: Number(smtpPort) || 587,
              smtpUser: smtpUser || undefined,
              smtpPassword: smtpPassword || undefined,
              emailFrom: emailFrom || undefined,
              emailTo: emailTo.trim(),
            }),
      },
      { onSuccess: () => { setOpen(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add channel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add notification channel</DialogTitle>
          <DialogDescription>
            Get notified on deploy failures, crashes, and backup failures.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <Input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team alerts" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as NotificationChannelKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
                <SelectItem value="webhook">Generic webhook</SelectItem>
                <SelectItem value="email">Email (SMTP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isWebhookKind ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">
                  {kind === 'slack' ? 'Slack webhook URL' : kind === 'discord' ? 'Discord webhook URL' : 'Webhook URL'}
                </Label>
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="https://..."
                />
              </div>
              {kind === 'webhook' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-secret">Signing secret (optional)</Label>
                  <Input
                    id="webhook-secret"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-muted-foreground text-xs">
                    Signs each payload in an <code>X-Berth-Signature</code> header.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-host">SMTP host</Label>
                  <Input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input id="smtp-port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-user">SMTP username</Label>
                <Input id="smtp-user" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-password">SMTP password</Label>
                <Input id="smtp-password" type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-from">From address</Label>
                <Input id="email-from" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="berth@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-to">Send to</Label>
                <Input id="email-to" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="ops@example.com" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending || !canSubmit}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NotificationChannelsSettings() {
  const channels = useNotificationChannels();
  const setEnabled = useSetNotificationChannelEnabled();
  const remove = useRemoveNotificationChannel();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Notification channels</CardTitle>
        <AddChannelDialog />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Berth notifies these channels on deploy success/failure, unexpected
          crashes, and backup or restore failures.
        </p>
        {channels.data && channels.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{KIND_LABEL[c.kind]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={c.enabled}
                      disabled={setEnabled.isPending}
                      onCheckedChange={(enabled) => setEnabled.mutate({ id: c.id, enabled })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            No notification channels yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
