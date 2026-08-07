import { BaseApiClient } from './baseApiClient';

export interface GithubStatus { configured: boolean; connected: boolean; accountLogin?: string }
export interface GithubRepo { fullName: string; private: boolean; defaultBranch: string }

export interface GithubManifest { url: string; manifest: Record<string, unknown> }

class GithubService extends BaseApiClient {
  protected resource = 'github';
  status() { return this.get<GithubStatus>('/status'); }
  manifest() { return this.get<GithubManifest>('/manifest'); }
  install() { return this.get<{ url: string }>('/install'); }
  repositories() { return this.get<GithubRepo[]>('/repositories'); }
  branches(repo: string) { return this.get<{ name: string }[]>(`/branches?repo=${encodeURIComponent(repo)}`); }
}
export const githubService = new GithubService();
