import { describe, expect, it, vi } from 'vitest';
import { AdvisorRepository } from './advisor.repository';

const candidate = (fingerprint: string) => ({
  fingerprint,
  kind: 'resources',
  severity: 'info',
  source: 'rules',
  title: 't',
  detail: 'd',
  evidence: [],
  serviceId: 's1',
});

function build(open: { id: string; fingerprint: string; source: string }[], declined: string[]) {
  const finding = {
    findMany: vi.fn().mockImplementation(async ({ where }: { where: { status: string } }) =>
      where.status === 'open' ? open : declined.map((fingerprint) => ({ fingerprint })),
    ),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({}),
  };
  return { repository: new AdvisorRepository({ advisorFinding: finding } as never), finding };
}

describe('AdvisorRepository.saveCandidates', () => {
  it('does not bring back a suggestion the user declined', async () => {
    const { repository, finding } = build([], ['mem-1024']);
    const saved = await repository.saveCandidates('o1', [candidate('mem-1024'), candidate('disk-9')] as never, ['rules']);
    expect(saved).toBe(1);
    expect(finding.create).toHaveBeenCalledTimes(1);
    expect(finding.create.mock.calls[0][0].data.fingerprint).toBe('disk-9');
  });

  it('updates an open suggestion in place and retires ones no longer true', async () => {
    const { repository, finding } = build(
      [
        { id: 'a', fingerprint: 'keep', source: 'rules' },
        { id: 'b', fingerprint: 'gone', source: 'rules' },
        { id: 'c', fingerprint: 'ai-one', source: 'ai' },
      ],
      [],
    );
    await repository.saveCandidates('o1', [candidate('keep')] as never, ['rules']);
    expect(finding.update).toHaveBeenCalledTimes(1);
    expect(finding.create).not.toHaveBeenCalled();
    expect(finding.updateMany.mock.calls[0][0].where.id.in).toEqual(['b']);
  });
});
