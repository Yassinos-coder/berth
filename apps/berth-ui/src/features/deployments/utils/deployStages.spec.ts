import { describe, expect, it } from 'vitest';
import { DeployStages } from '@/features/deployments/utils/deployStages';

const states = (stages: { state: string }[]) => stages.map((stage) => stage.state);

describe('DeployStages (git)', () => {
  const git = (status: Parameters<typeof DeployStages.compute>[0]['status'], lines: string[]) =>
    DeployStages.compute({ sourceKind: 'git', status, lines });

  it('shows clone, build, start and health check in order', () => {
    expect(git('queued', []).map((stage) => stage.label)).toEqual(['Clone', 'Build', 'Start', 'Health check']);
  });

  it('starts at clone before any output arrives', () => {
    expect(states(git('queued', []))).toEqual(['active', 'pending', 'pending', 'pending']);
  });

  it('advances as markers arrive', () => {
    expect(states(git('building', ['==> Build started', '==> Cloning branch main']))).toEqual([
      'active',
      'pending',
      'pending',
      'pending',
    ]);
    expect(states(git('building', ['==> Cloning branch main', '==> Building with Dockerfile', 'step 1']))).toEqual([
      'done',
      'active',
      'pending',
      'pending',
    ]);
    expect(
      states(git('deploying', ['==> Cloning branch main', '==> Building with Nixpacks', '==> Build finished', '==> Starting container'])),
    ).toEqual(['done', 'done', 'active', 'pending']);
    expect(
      states(git('deploying', ['==> Building with Dockerfile', '==> Starting container', '==> Waiting for health check'])),
    ).toEqual(['done', 'done', 'done', 'active']);
  });

  it('completes once the container is healthy, even before the status settles', () => {
    expect(states(git('deploying', ['==> Waiting for health check', '==> Container healthy']))).toEqual([
      'done',
      'done',
      'done',
      'done',
    ]);
  });

  it('is fully done when the deployment is live', () => {
    expect(states(git('live', []))).toEqual(['done', 'done', 'done', 'done']);
  });

  it('marks the stage that was running as failed', () => {
    expect(states(git('failed', ['==> Cloning branch main', '==> Building with Dockerfile']))).toEqual([
      'done',
      'failed',
      'pending',
      'pending',
    ]);
    expect(
      states(git('failed', ['==> Building with Dockerfile', '==> Starting container', '==> Waiting for health check', '==> Health check failed: x'])),
    ).toEqual(['done', 'done', 'done', 'failed']);
  });

  it('fails the first stage when nothing ran', () => {
    expect(states(git('failed', []))).toEqual(['failed', 'pending', 'pending', 'pending']);
  });

  it('does not treat an old finish marker as success for a failed deployment', () => {
    expect(states(git('failed', ['==> Building with Dockerfile', '==> Container healthy']))[1]).toBe('failed');
  });
});

describe('DeployStages (image)', () => {
  it('has no clone or build step', () => {
    const stages = DeployStages.compute({ sourceKind: 'image', status: 'deploying', lines: ['==> Pulling image nginx:alpine'] });
    expect(stages.map((stage) => stage.label)).toEqual(['Pull image', 'Start', 'Health check']);
    expect(states(stages)).toEqual(['active', 'pending', 'pending']);
  });

  it('finishes on a first deploy that has no health check', () => {
    const stages = DeployStages.compute({
      sourceKind: 'image',
      status: 'deploying',
      lines: ['==> Pulling image x', '==> Starting container', '==> Container started'],
    });
    expect(states(stages)).toEqual(['done', 'done', 'done']);
  });
});

describe('DeployStages.isInFlight', () => {
  it('is true only for unfinished statuses', () => {
    expect(DeployStages.isInFlight('queued')).toBe(true);
    expect(DeployStages.isInFlight('building')).toBe(true);
    expect(DeployStages.isInFlight('deploying')).toBe(true);
    expect(DeployStages.isInFlight('live')).toBe(false);
    expect(DeployStages.isInFlight('failed')).toBe(false);
  });
});
