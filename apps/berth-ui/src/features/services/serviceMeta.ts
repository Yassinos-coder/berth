import { Boxes, Database, GitBranch, HardDrive } from 'lucide-react';
import type { ServiceKind, ServiceSource } from '@/interfaces';

export const KIND_META: Record<
  ServiceKind,
  { label: string; icon: typeof Boxes }
> = {
  git: { label: 'Git repository', icon: GitBranch },
  image: { label: 'Docker image', icon: Boxes },
  database: { label: 'Database', icon: Database },
  bucket: { label: 'Bucket', icon: HardDrive },
};

export function sourceSummary(source: ServiceSource): string {
  if (source.kind === 'git') return `${source.repo} · ${source.branch}`;
  return `${source.image}:${source.tag}`;
}

export function builderLabel(source: ServiceSource): string | null {
  if (source.kind !== 'git') return null;
  const map = { auto: 'Auto (Nixpacks)', nixpacks: 'Nixpacks', dockerfile: 'Dockerfile' };
  return map[source.build.builder];
}
