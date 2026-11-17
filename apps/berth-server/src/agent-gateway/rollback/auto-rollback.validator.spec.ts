import { describe, expect, it } from 'vitest';
import { AutoRollbackValidator } from './auto-rollback.validator';
import type { AutoRollbackCandidate } from '../interfaces';

const NOW = new Date('2026-11-17T12:00:00Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const deployment = (overrides: Partial<AutoRollbackCandidate>): AutoRollbackCandidate => ({
  id: 'd',
  status: 'live',
  trigger: 'push',
  commitSha: 'a'.repeat(40),
  createdAt: minutesAgo(5),
  durationSeconds: 60,
  ...overrides,
});

const history = [
  deployment({ id: 'new', commitSha: 'b'.repeat(40), createdAt: minutesAgo(5) }),
  deployment({ id: 'old', commitSha: 'a'.repeat(40), createdAt: minutesAgo(120) }),
];

const decide = (overrides: Record<string, unknown> = {}) =>
  AutoRollbackValidator.decide({ autoRollback: true, sourceKind: 'git', now: NOW, deployments: history, ...overrides });

describe('AutoRollbackValidator', () => {
  it('rolls back to the previous live deployment when a fresh one crashes', () => {
    expect(decide()?.id).toBe('old');
  });

  it('does nothing when the service opted out', () => {
    expect(decide({ autoRollback: false })).toBeNull();
  });

  it('only applies to git services, which have commits to restore', () => {
    expect(decide({ sourceKind: 'image' })).toBeNull();
  });

  it('ignores crashes long after the deploy, which are unlikely to be the deploy', () => {
    const stale = [deployment({ id: 'new', commitSha: 'b'.repeat(40), createdAt: minutesAgo(180) }), history[1]];
    expect(decide({ deployments: stale })).toBeNull();
  });

  it('never rolls back a rollback, so it cannot loop', () => {
    const rolled = [deployment({ id: 'rb', trigger: 'rollback', commitSha: 'a'.repeat(40) }), history[0]];
    expect(decide({ deployments: rolled })).toBeNull();
  });

  it('needs an earlier live deployment with a different commit', () => {
    expect(decide({ deployments: [history[0]] })).toBeNull();
    const same = [history[0], deployment({ id: 'same', commitSha: 'b'.repeat(40), createdAt: minutesAgo(90) })];
    expect(decide({ deployments: same })).toBeNull();
  });

  it('skips earlier deployments that failed', () => {
    const withFailure = [
      history[0],
      deployment({ id: 'bad', status: 'failed', commitSha: 'c'.repeat(40), createdAt: minutesAgo(60) }),
      history[1],
    ];
    expect(decide({ deployments: withFailure })?.id).toBe('old');
  });

  it('ignores a deployment that is not live yet', () => {
    const building = [deployment({ id: 'new', status: 'building' }), history[1]];
    expect(decide({ deployments: building })).toBeNull();
  });
});
