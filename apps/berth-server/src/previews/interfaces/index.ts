export type PullRequestAction = 'opened' | 'reopened' | 'synchronize' | 'closed';

export interface PullRequestEvent {
  action: PullRequestAction;
  number: number;
  repo: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  title: string;
  author: string;
}
