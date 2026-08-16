import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyButton } from '@/components/shared/CopyButton';
import { ASSIGNABLE_ROLES, ROLE_META } from '@/features/team/roleMeta';
import { useInviteMember } from '@/hooks/useTeamQueries';
import { notify } from '@/lib/toast';
import type { Role } from '@/interfaces';

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('deployer');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const invite = useInviteMember();

  const reset = () => {
    setEmail('');
    setRole('deployer');
    setInviteLink(null);
  };

  const submit = () => {
    if (!email.includes('@')) return notify.warn('Enter a valid email');
    invite.mutate(
      { email, role },
      {
        onSuccess: ({ inviteToken }) => {
          setInviteLink(
            `${window.location.origin}/accept-invite?token=${inviteToken}`,
          );
        },
      },
    );
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" aria-hidden="true" /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            Berth has no email provider configured â€” share the invite link
            with them yourself (Slack, email, whatever works).
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_META[r].label} â€” {ROLE_META[r].description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={invite.isPending}>
                {invite.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Create invite
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">
                Invite link
              </Label>
              <div className="bg-muted flex items-start gap-2 rounded-lg border p-3">
                <code className="flex-1 font-mono text-xs break-all">
                  {inviteLink}
                </code>
                <CopyButton value={inviteLink} />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              This link expires in 7 days and can only be used once.
            </p>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
