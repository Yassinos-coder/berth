import type { AutoRollbackCandidate, AutoRollbackInput } from '../interfaces';

export const AUTO_ROLLBACK_WINDOW_MS = 15 * 60 * 1000;

export class AutoRollbackValidator {
  static decide(input: AutoRollbackInput): AutoRollbackCandidate | null {
    if (!input.autoRollback || input.sourceKind !== 'git') return null;

    const [current, ...earlier] = input.deployments;
    if (!current || current.status !== 'live' || !current.commitSha) return null;
    if (current.trigger === 'rollback') return null;

    const wentLiveAt =
      current.createdAt.getTime() + (current.durationSeconds ?? 0) * 1000;
    const sinceLive = input.now.getTime() - wentLiveAt;
    if (sinceLive > (input.windowMs ?? AUTO_ROLLBACK_WINDOW_MS)) return null;

    return (
      earlier.find(
        (deployment) =>
          deployment.status === 'live' &&
          Boolean(deployment.commitSha) &&
          deployment.commitSha !== current.commitSha,
      ) ?? null
    );
  }
}
