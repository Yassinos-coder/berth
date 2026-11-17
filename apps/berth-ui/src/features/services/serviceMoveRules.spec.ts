import { describe, expect, it } from 'vitest';
import { ServiceMoveRules } from '@/features/services/serviceMoveRules';
import type { Server } from '@/interfaces';

const server = (id: string, status: string) => ({ id, status, name: id, cpuCores: 4, memoryMb: 4096 }) as unknown as Server;

describe('ServiceMoveRules', () => {
  it('offers only other servers that are online', () => {
    const list = [server('a', 'online'), server('b', 'online'), server('c', 'offline'), server('d', 'enrolling')];
    expect(ServiceMoveRules.targets(list, 'a').map((item) => item.id)).toEqual(['b']);
  });

  it('warns about files and DNS only when they apply', () => {
    expect(ServiceMoveRules.warnings(false, false)).toHaveLength(1);
    expect(ServiceMoveRules.warnings(true, true)).toHaveLength(3);
    expect(ServiceMoveRules.warnings(true, false).join(' ')).toMatch(/files/);
  });
});
