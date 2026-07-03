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
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function MemberRow({ member }: { member: Member }) {
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const isOwner = member.role === 'owner';

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            {member.avatarUrl ? (
              <AvatarImage src={member.avatarUrl} alt={member.name} />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{member.name}</p>
            <p className="text-muted-foreground text-xs">{member.email}</p>
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
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Change role</DropdownMenuLabel>
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
                onClick={() => removeMember.mutate(member.id)}
              >
                Remove from org
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
