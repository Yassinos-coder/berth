import type { DeploymentStatus } from '@/interfaces';

export type StageState = 'pending' | 'active' | 'done' | 'failed';

export interface DeployStage {
  id: string;
  label: string;
  state: StageState;
}

interface StageDefinition {
  id: string;
  label: string;
  marker: string;
}

const GIT_STAGES: StageDefinition[] = [
  { id: 'clone', label: 'Clone', marker: '==> Cloning' },
  { id: 'build', label: 'Build', marker: '==> Building with' },
  { id: 'start', label: 'Start', marker: '==> Starting container' },
  { id: 'health', label: 'Health check', marker: '==> Waiting for health check' },
];

const IMAGE_STAGES: StageDefinition[] = [
  { id: 'pull', label: 'Pull image', marker: '==> Pulling image' },
  { id: 'start', label: 'Start', marker: '==> Starting container' },
  { id: 'health', label: 'Health check', marker: '==> Waiting for health check' },
];

const FINISH_MARKERS = ['==> Container healthy', '==> Container started'];
const IN_FLIGHT: DeploymentStatus[] = ['queued', 'building', 'deploying'];

export class DeployStages {
  static isInFlight(status: DeploymentStatus): boolean {
    return IN_FLIGHT.includes(status);
  }

  static compute(input: {
    sourceKind: 'git' | 'image';
    status: DeploymentStatus;
    lines: string[];
  }): DeployStage[] {
    const definitions = input.sourceKind === 'git' ? GIT_STAGES : IMAGE_STAGES;

    if (input.status === 'live') {
      return definitions.map(({ id, label }) => ({ id, label, state: 'done' }));
    }

    const finished = input.lines.some((line) => FINISH_MARKERS.some((marker) => line.startsWith(marker)));
    if (finished && input.status !== 'failed') {
      return definitions.map(({ id, label }) => ({ id, label, state: 'done' }));
    }

    let reached = -1;
    definitions.forEach((definition, index) => {
      if (input.lines.some((line) => line.startsWith(definition.marker))) reached = index;
    });

    if (input.status === 'failed' || input.status === 'canceled') {
      const failedAt = Math.max(reached, 0);
      return definitions.map(({ id, label }, index) => ({
        id,
        label,
        state: index < failedAt ? 'done' : index === failedAt ? 'failed' : 'pending',
      }));
    }

    const activeAt = Math.max(reached, 0);
    return definitions.map(({ id, label }, index) => ({
      id,
      label,
      state: index < activeAt ? 'done' : index === activeAt ? 'active' : 'pending',
    }));
  }
}
