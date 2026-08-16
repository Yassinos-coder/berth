import { useState } from 'react';
import { MoreHorizontal, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { InviteMemberDialog } from '@/features/team/InviteMemberDialog';
import { ASSIGNABLE_ROLES, ROLE_META } from '@/features/team/roleMeta';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useTeam,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/useTeamQueries';
import { Format } from '@/lib/format';
import type { Member, Role } from '@/interfaces';

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function MemberRow({ member }: { member: Member }) {
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isOwner = member.role === 'owner';

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            {member.avatarUrl ? (
              <AvatarImage
                src={member.avatarUrl}
                alt=""
                width={40}
                height={40}
                loading="lazy"
              />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" translate="no">
              {member.name}
            </p>
            <p className="text-muted-foreground truncate text-xs" translate="no">
              {member.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={isOwner ? 'default' : 'secondary'}>
          {ROLE_META[member.role].label}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={member.status === 'active' ? 'success' : 'outline'}
          className="capitalize"
        >
          {member.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {Format.relativeTime(member.lastActive)}
      </TableCell>
      <TableCell className="text-right">
        {isOwner ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${member.name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Change Role</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={member.role}
                onValueChange={(role) =>
                  updateRole.mutate({ id: member.id, role: role as Role })
                }
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r}>
                    {ROLE_META[r].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirmRemove(true);
                }}
              >
                Remove from Org
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {member.name}?</DialogTitle>
              <DialogDescription>
                They lose access to every server and service in this
                organization immediately. You can invite them again later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={removeMember.isPending}
                onClick={() => {
                  removeMember.mutate(member.id);
                  setConfirmRemove(false);
                }}
              >
                Remove Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

export function TeamPage() {
  const { data, isLoading, isError, error, refetch } = useTeam();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Role-based access across your organization."
        actions={<InviteMemberDialog />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(ROLE_META) as Role[])
          .sort((a, b) => ROLE_META[b].rank - ROLE_META[a].rank)
          .map((r) => (
            <Card key={r} className="gap-1 p-4">
              <p className="text-sm font-medium">{ROLE_META[r].label}</p>
              <p className="text-muted-foreground text-xs leading-snug">
                {ROLE_META[r].description}
              </p>
            </Card>
          ))}
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={<Skeleton className="h-72" />}
      >
        {(data ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Invite teammates and assign them roles."
            action={<InviteMemberDialog />}
          />
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}
