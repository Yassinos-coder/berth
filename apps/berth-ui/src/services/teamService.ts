import { BaseApiClient } from '@/services/baseApiClient';
import type { Member, Role } from '@/interfaces';

export interface InviteMemberPayload {
  email: string;
  role: Role;
}

export interface InviteMemberResult {
  member: Member;
  inviteToken: string;
}

class TeamService extends BaseApiClient {
  protected resource = 'team';

  list(): Promise<Member[]> {
    return this.get<Member[]>();
  }

  invite(payload: InviteMemberPayload): Promise<InviteMemberResult> {
    return this.post<InviteMemberResult>('/invite', payload);
  }

  updateRole(id: string, role: Role): Promise<Member> {
    return this.patch<Member>(`/${id}`, { role });
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const teamService = new TeamService();
