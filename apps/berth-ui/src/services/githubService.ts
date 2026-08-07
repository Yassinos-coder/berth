import { BaseApiClient } from './baseApiClient';

export interface GithubStatus { configured: boolean; connected: boolean; accountLogin?: string }
export interface GithubRepo { fullName: string; private: boolean; defaultBranch: string }

class GithubService extends BaseApiClient {
  protected resource = 'github';
  status() { return this.get<GithubStatus>('/status'); }
  install() { return this.get<{ url: string }>('/install'); }
  repositories() { return this.get<GithubRepo[]>('/repositories'); }
  branches(repo: string) { return this.get<{ name: string }[]>(`/branches?repo=${encodeURIComponent(repo)}`); }
}
export const githubService = new GithubService();
