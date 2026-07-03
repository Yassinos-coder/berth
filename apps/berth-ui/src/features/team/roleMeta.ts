import type { Role } from '@/interfaces';

export const ROLE_META: Record<
  Role,
  { label: string; description: string; rank: number }
> = {
  owner: {
    label: 'Owner',
    description: 'Full control — billing, delete org, everything.',
    rank: 4,
  },
  admin: {
    label: 'Admin',
    description: 'Manage servers, members, and settings.',
    rank: 3,
  },
  deployer: {
    label: 'Deployer',
    description: 'Deploy, restart, and set resource limits.',
    rank: 2,
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access, including logs.',
    rank: 1,
  },
};

export const ASSIGNABLE_ROLES: Role[] = ['admin', 'deployer', 'viewer'];
