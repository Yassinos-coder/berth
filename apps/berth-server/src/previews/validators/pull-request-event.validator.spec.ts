import { describe, expect, it } from 'vitest';
import { PullRequestEventValidator } from './pull-request-event.validator';

const payload = (overrides: Record<string, unknown> = {}) => ({
  action: 'opened',
  repository: { full_name: 'acme/web' },
  pull_request: {
    number: 7,
    title: 'Add thing',
    user: { login: 'dev' },
    head: { ref: 'feature', sha: 'abc123', repo: { full_name: 'acme/web' } },
    base: { ref: 'main' },
  },
  ...overrides,
});

describe('PullRequestEventValidator', () => {
  it('parses an opened pull request', () => {
    expect(PullRequestEventValidator.parse(payload())).toEqual({
      action: 'opened',
      number: 7,
      repo: 'acme/web',
      headRef: 'feature',
      headSha: 'abc123',
      baseRef: 'main',
      title: 'Add thing',
      author: 'dev',
    });
  });

  it.each(['opened', 'reopened', 'synchronize', 'closed'])('handles %s', (action) => {
    expect(PullRequestEventValidator.parse(payload({ action }))?.action).toBe(action);
  });

  it.each(['labeled', 'edited', 'assigned', 'review_requested'])('ignores %s', (action) => {
    expect(PullRequestEventValidator.parse(payload({ action }))).toBeNull();
  });

  it('rejects pull requests from forks', () => {
    const fork = payload();
    (fork.pull_request.head as { repo: { full_name: string } }).repo.full_name = 'evil/web';
    expect(PullRequestEventValidator.parse(fork)).toBeNull();
  });

  it('rejects pull requests whose head repository was deleted', () => {
    const gone = payload();
    (gone.pull_request.head as { repo: unknown }).repo = null;
    expect(PullRequestEventValidator.parse(gone)).toBeNull();
  });

  it.each([null, undefined, 'x', 5, {}, { action: 'opened' }])('rejects malformed body %j', (body) => {
    expect(PullRequestEventValidator.parse(body)).toBeNull();
  });

  it('rejects a non-positive pull request number', () => {
    const bad = payload();
    bad.pull_request.number = 0;
    expect(PullRequestEventValidator.parse(bad)).toBeNull();
  });
});
