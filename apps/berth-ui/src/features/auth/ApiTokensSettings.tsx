import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { CopyButton } from '@/components/shared/CopyButton';
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
} from '@/hooks/useApiTokens';
import { Format } from '@/lib/format';
import type { CreatedApiToken } from '@/interfaces';

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiration' },
];

function CreateTokenDialog({ onCreated }: { onCreated: (token: CreatedApiToken) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('90');
  const create = useCreateApiToken();

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        expiresInDays: expiry === 'never' ? undefined : Number(expiry),
      },
      {
        onSuccess: (token) => {
          onCreated(token);
          setOpen(false);
          setName('');
          setExpiry('90');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" /> Create token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create API token</DialogTitle>
          <DialogDescription>
            Use this token to authenticate CLI or CI requests to the Berth
            API. It carries your account&rsquo;s current role and
            permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-name">Name</Label>
            <Input
              id="token-name"
              placeholder="CI deploy token"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="space-y-2">
            <Label>Expiration</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending || !name.trim()}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevealTokenDialog({
  token,
  onClose,
}: {
  token: CreatedApiToken | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(token)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy your API token</DialogTitle>
          <DialogDescription>
            This is the only time the full token is shown. Store it somewhere
            safe.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="bg-muted flex items-start gap-2 rounded-lg border p-3">
            <code className="flex-1 font-mono text-xs break-all">
              {token.token}
            </code>
            <CopyButton value={token.token} />
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiTokensSettings() {
  const tokens = useApiTokens();
  const revoke = useRevokeApiToken();
  const [revealed, setRevealed] = useState<CreatedApiToken | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">API tokens</CardTitle>
        <CreateTokenDialog onCreated={setRevealed} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Personal access tokens authenticate CLI, CI, and script requests to
          the Berth API on your behalf. Each token acts with your current
          account role.
        </p>
        {tokens.data && tokens.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <code className="text-muted-foreground text-xs">
                      {t.tokenPrefix}…
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.lastUsedAt ? Format.relativeTime(t.lastUsedAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.expiresAt ? Format.relativeTime(t.expiresAt) : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(t.id)}
                    >
                      <Trash2 className="text-destructive size-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            No API tokens yet.
          </p>
        )}
      </CardContent>
      <RevealTokenDialog token={revealed} onClose={() => setRevealed(null)} />
    </Card>
  );
}
