import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  teamService,
  type InviteMemberPayload,
} from '@/services/teamService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';
import type { Role } from '@/interfaces';

export function useTeam() {
  return useQuery({
    queryKey: queryKeys.team,
    queryFn: () => teamService.list(),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => teamService.invite(payload),
    onSuccess: (member) => {
      qc.invalidateQueries({ queryKey: queryKeys.team });
      notify.success(`Invited ${member.email}`);
    },
    onError: (error) =>
      notify.error('Invite failed', { description: error.message }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      teamService.updateRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.team });
      notify.success('Role updated');
    },
    onError: (error) =>
      notify.error('Could not update role', { description: error.message }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.team });
      notify.success('Member removed');
    },
    onError: (error) =>
      notify.error('Could not remove member', { description: error.message }),
  });
}
