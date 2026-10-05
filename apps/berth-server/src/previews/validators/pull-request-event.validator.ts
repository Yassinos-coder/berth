import type { PullRequestAction, PullRequestEvent } from '../interfaces';

const HANDLED_ACTIONS: PullRequestAction[] = ['opened', 'reopened', 'synchronize', 'closed'];

export class PullRequestEventValidator {
  static parse(body: unknown): PullRequestEvent | null {
    if (typeof body !== 'object' || body === null) return null;
    const payload = body as Record<string, any>;

    const action = payload.action;
    if (!HANDLED_ACTIONS.includes(action)) return null;

    const pullRequest = payload.pull_request;
    const repo = payload.repository?.full_name;
    if (!pullRequest || typeof repo !== 'string') return null;
    if (!Number.isInteger(pullRequest.number) || pullRequest.number <= 0) return null;

    const headRef = pullRequest.head?.ref;
    const headSha = pullRequest.head?.sha;
    const baseRef = pullRequest.base?.ref;
    if (typeof headRef !== 'string' || typeof headSha !== 'string' || typeof baseRef !== 'string') {
      return null;
    }

    if (pullRequest.head?.repo?.full_name !== repo) return null;

    return {
      action,
      number: pullRequest.number,
      repo,
      headRef,
      headSha,
      baseRef,
      title: typeof pullRequest.title === 'string' ? pullRequest.title : '',
      author: typeof pullRequest.user?.login === 'string' ? pullRequest.user.login : '',
    };
  }
}
