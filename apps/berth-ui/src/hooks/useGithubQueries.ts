import { useQuery } from '@tanstack/react-query';
import { githubService } from '@/services/githubService';

export const useGithubStatus = () => useQuery({ queryKey: ['github', 'status'], queryFn: () => githubService.status() });
export const useGithubRepos = (enabled = true) => useQuery({ queryKey: ['github', 'repos'], queryFn: () => githubService.repositories(), enabled });
export const useGithubBranches = (repo: string) => useQuery({ queryKey: ['github', 'branches', repo], queryFn: () => githubService.branches(repo), enabled: Boolean(repo) });
export const useGithubTree = (repo: string, branch: string) => useQuery({ queryKey: ['github', 'tree', repo, branch], queryFn: () => githubService.tree(repo, branch), enabled: Boolean(repo && branch), staleTime: 60_000 });
