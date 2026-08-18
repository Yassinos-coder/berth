import type { GithubTree } from '@/services/githubService';

export interface DetectedApp {
  name: string;
  dockerfilePath: string;
}

function nameFromDockerfilePath(path: string, repoName: string): string {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const base = dir ? dir.split('/').pop()! : repoName;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function detectMonorepoApps(
  tree: GithubTree,
  repoName: string,
): DetectedApp[] {
  if (tree.dockerfiles.length < 2) return [];
  return tree.dockerfiles.map((dockerfilePath) => ({
    name: nameFromDockerfilePath(dockerfilePath, repoName),
    dockerfilePath,
  }));
}
