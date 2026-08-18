import { useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/shared/CopyButton';
import {
  useConfirmTotp,
  useDisableTotp,
  useRegenerateRecoveryCodes,
  useSetupTotp,
  useTotpStatus,
} from '@/hooks/useTotp';

function extractSecret(otpauthUrl: string): string {
  const query = otpauthUrl.split('?')[1] ?? '';
  return new URLSearchParams(query).get('secret') ?? '';
}

function RecoveryCodesReveal({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Save your recovery codes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Each code works once to sign in if you lose access to your
          authenticator app. Store them somewhere safe — they will not be
          shown again.
        </p>
        <div className="bg-muted grid grid-cols-2 gap-2 rounded-lg border p-4 font-mono text-sm">
          {codes.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <CopyButton value={codes.join('\n')} label="Copy all" />
          <Button onClick={onDone}>I&rsquo;ve saved these codes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DisableTotpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const disable = useDisableTotp();

  const submit = () => {
    disable.mutate(password, {
      onSuccess: () => {
        onOpenChange(false);
        setPassword('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Confirm your password to turn off two-factor authentication for
            your account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="disable-password">Password</Label>
          <Input
            id="disable-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={disable.isPending || !password}
          >
            {disable.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Disable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegenerateCodesDialog({
  open,
  onOpenChange,
  onCodes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCodes: (codes: string[]) => void;
}) {
  const [password, setPassword] = useState('');
  const regenerate = useRegenerateRecoveryCodes();

  const submit = () => {
    regenerate.mutate(password, {
      onSuccess: (data) => {
        onOpenChange(false);
        setPassword('');
        onCodes(data.recoveryCodes);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Regenerate recovery codes</DialogTitle>
          <DialogDescription>
            Your existing recovery codes will stop working. Confirm your
            password to generate a new set.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="regen-password">Password</Label>
          <Input
            id="regen-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={regenerate.isPending || !password}
          >
            {regenerate.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TwoFactorSettings() {
  const status = useTotpStatus();
  const setup = useSetupTotp();
  const confirm = useConfirmTotp();
  const [code, setCode] = useState('');
  const [revealCodes, setRevealCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  if (revealCodes) {
    return (
      <RecoveryCodesReveal
        codes={revealCodes}
        onDone={() => {
          setRevealCodes(null);
          setup.reset();
        }}
      />
    );
  }

  if (setup.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Set up two-factor authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Scan this QR code with an authenticator app (Google Authenticator,
            1Password, Authy), then enter the 6-digit code it shows.
          </p>
          <img
            src={setup.data.qrCodeDataUrl}
            alt="Two-factor authentication QR code"
            className="size-48 rounded-lg border p-2"
          />
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">
              Or enter this key manually
            </Label>
            <code className="bg-muted block max-w-xs rounded px-2 py-1 text-xs break-all">
              {extractSecret(setup.data.otpauthUrl)}
            </code>
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="totp-code">Verification code</Label>
            <Input
              id="totp-code"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                confirm.mutate(code, {
                  onSuccess: (data) => {
                    setRevealCodes(data.recoveryCodes);
                    setCode('');
                  },
                })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={confirm.isPending || !code}
              onClick={() =>
                confirm.mutate(code, {
                  onSuccess: (data) => {
                    setRevealCodes(data.recoveryCodes);
                    setCode('');
                  },
                })
              }
            >
              {confirm.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Enable
            </Button>
            <Button variant="outline" onClick={() => setup.reset()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            {status.data?.enabled ? (
              <ShieldCheck className="text-success mt-0.5 size-5" aria-hidden="true" />
            ) : (
              <ShieldOff className="text-muted-foreground mt-0.5 size-5" aria-hidden="true" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {status.data?.enabled ? 'Enabled' : 'Not enabled'}
              </p>
              <p className="text-muted-foreground max-w-md text-sm">
                Require a verification code from an authenticator app in
                addition to your password when signing in.
              </p>
            </div>
          </div>
          {status.data?.enabled ? (
            <Badge variant="success">Enabled</Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          {status.data?.enabled ? (
            <>
              <Button variant="outline" onClick={() => setRegenOpen(true)}>
                Regenerate recovery codes
              </Button>
              <Button variant="destructive" onClick={() => setDisableOpen(true)}>
                Disable
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setup.mutate()}
              disabled={setup.isPending || status.isLoading}
            >
              {setup.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Enable two-factor authentication
            </Button>
          )}
        </div>
      </CardContent>

      <DisableTotpDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <RegenerateCodesDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        onCodes={setRevealCodes}
      />
    </Card>
  );
}
