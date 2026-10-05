import { describe, expect, it } from 'vitest';
import type { Service } from '@/interfaces';
import type { Environment } from '@/services/environmentsService';
import { ServiceGroups } from '@/features/environments/utils/serviceGroups';

const env = (id: string, name: string, extra: Partial<Environment> = {}): Environment => ({
  id,
  name,
  slug: name.toLowerCase(),
  isProduction: false,
  preview: false,
  _count: { services: 0 },
  ...extra,
});

const svc = (id: string, environmentId?: string) => ({ id, name: id, environmentId }) as unknown as Service;

const production = env('prod', 'Production', { isProduction: true });
const staging = env('stg', 'Staging');
const previews = env('prv', 'Previews', { preview: true });

describe('ServiceGroups.group', () => {
  it('puts production first, previews last, and unassigned services at the end', () => {
    const groups = ServiceGroups.group(
      [svc('a', 'stg'), svc('b'), svc('c', 'prv'), svc('d', 'prod')],
      [previews, staging, production],
    );
    expect(groups.map((group) => group.name)).toEqual(['Production', 'Staging', 'Previews', 'No environment']);
    expect(groups[3].id).toBeNull();
  });

  it('keeps each service in exactly one group', () => {
    const groups = ServiceGroups.group([svc('a', 'prod'), svc('b', 'prod'), svc('c')], [production]);
    expect(groups.map((group) => group.services.map((service) => service.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('omits environments that have no services in view', () => {
    const groups = ServiceGroups.group([svc('a', 'prod')], [production, staging]);
    expect(groups.map((group) => group.name)).toEqual(['Production']);
  });

  it('treats a deleted or foreign environment as unassigned', () => {
    const groups = ServiceGroups.group([svc('a', 'gone')], [production]);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBeNull();
  });

  it('returns nothing for no services', () => {
    expect(ServiceGroups.group([], [production])).toEqual([]);
  });

  it('sorts same-kind environments by name', () => {
    const groups = ServiceGroups.group([svc('a', 'z'), svc('b', 'a')], [env('z', 'Zeta'), env('a', 'Alpha')]);
    expect(groups.map((group) => group.name)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('ServiceGroups.hasAssignments', () => {
  it('is true only when a service sits in a known environment', () => {
    expect(ServiceGroups.hasAssignments([svc('a', 'prod')], [production])).toBe(true);
    expect(ServiceGroups.hasAssignments([svc('a')], [production])).toBe(false);
    expect(ServiceGroups.hasAssignments([svc('a', 'gone')], [production])).toBe(false);
  });
});
