import { describe, expect, it } from 'vitest';
import type { Service } from '@prisma/client';
import { PreviewMapper } from './preview.mapper';

const parent = {
  id: 'p1',
  orgId: 'o1',
  serverId: 's1',
  name: 'web',
  kind: 'git',
  sourceKind: 'git',
  repo: 'acme/web',
  branch: 'main',
  builder: 'auto',
  dockerfilePath: null,
  rootDirectory: 'app',
  buildCommand: null,
  startCommand: null,
  command: [],
  cpuCores: 1,
  memoryMb: 512,
  cpuShares: null,
  containerPort: 3000,
  publicNetworking: false,
  registryCredentialId: null,
  targetPlatform: null,
  environmentId: null,
  domain: 'app.example.com',
  previewsEnabled: true,
} as unknown as Service;

const pr = {
  action: 'opened' as const,
  number: 12,
  repo: 'acme/web',
  headRef: 'feat/x',
  headSha: 'deadbeef',
  baseRef: 'main',
  title: 't',
  author: 'a',
};

describe('PreviewMapper', () => {
  it('names previews after the parent and PR', () => {
    expect(PreviewMapper.name('web', pr)).toBe('web-pr-12');
  });

  it('prefixes the parent domain with the PR number', () => {
    expect(PreviewMapper.domain('app.example.com', pr)).toBe('pr-12.app.example.com');
  });

  it('builds the PR branch from the parent build config', () => {
    const data = PreviewMapper.toCreateData(parent, pr, 'web-pr-12-abc.berth.local');
    expect(data).toMatchObject({
      name: 'web-pr-12',
      branch: 'feat/x',
      repo: 'acme/web',
      rootDirectory: 'app',
      previewOfId: 'p1',
      prNumber: 12,
      specHash: 'deadbeef',
      internalDomains: ['web-pr-12-abc.berth.local'],
    });
  });

  it('never turns on previews for the preview itself', () => {
    const data = PreviewMapper.toCreateData(parent, pr, 'x') as Record<string, unknown>;
    expect(data.previewsEnabled).toBeUndefined();
    expect(data.domain).toBeUndefined();
  });
});
