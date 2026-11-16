import { describe, expect, it, vi } from 'vitest';
import { ReplicaEngineService } from './replica-engine.service';
import { ReplicaAutoscalerService } from './replica-autoscaler.service';

const NOW = 1_800_000_000_000;

const service = (overrides: object = {}) => ({
  id: 'svc-1',
  orgId: 'org-1',
  serverId: 'server-1',
  name: 'web',
  replicas: 1,
  memoryMb: 1000,
  replicaPolicy: {
    minReplicas: 1,
    maxReplicas: 4,
    targetCpuPct: 70,
    targetMemoryPct: 70,
    strategy: 'cpu',
    cooldownSeconds: 60,
  },
  lastReplicaScaleAt: null,
  publicNetworking: false,
  containerPort: 8080,
  volumePath: null,
  ...overrides,
});

function build(candidate = service(), samples = [{ serviceId: 'svc-1', _avg: { cpuPct: 95, memMb: 500 }, _max: { ts: new Date(NOW - 60_000) }, _count: { _all: 2 } }]) {
  const repository = {
    autoscalingCandidates: vi.fn().mockResolvedValue([candidate]),
    metricAggregates: vi.fn().mockResolvedValue(samples),
    claimReplicaScale: vi.fn().mockResolvedValue('claimed'),
  };
  const registry = { reconcileServer: vi.fn().mockResolvedValue(undefined) };
  const activity = { record: vi.fn().mockResolvedValue(undefined) };
  const autoscaler = new ReplicaAutoscalerService(
    repository as never,
    new ReplicaEngineService(),
    registry as never,
    activity as never,
  );
  return { autoscaler, repository, registry, activity };
}

describe('ReplicaAutoscalerService', () => {
  it('persists and reconciles a scale-up from fresh multi-sample metrics', async () => {
    const { autoscaler, repository, registry, activity } = build();

    await autoscaler.evaluate(NOW);

    expect(repository.claimReplicaScale).toHaveBeenCalledWith({
      serviceId: 'svc-1',
      serverId: 'server-1',
      currentReplicas: 1,
      lastReplicaScaleAt: null,
      nextReplicas: 2,
      scaledAt: new Date(NOW),
    });
    expect(registry.reconcileServer).toHaveBeenCalledWith('server-1');
    expect(activity.record).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ title: 'web autoscaled', actor: 'system' }),
    );
  });

  it('does not scale during cooldown or without fresh samples', async () => {
    const coolingDown = build(service({ lastReplicaScaleAt: new Date(NOW - 30_000) }));
    await coolingDown.autoscaler.evaluate(NOW);
    expect(coolingDown.repository.claimReplicaScale).not.toHaveBeenCalled();

    const stale = build(service(), [
      {
        serviceId: 'svc-1',
        _avg: { cpuPct: 95, memMb: 500 },
        _max: { ts: new Date(NOW - 3 * 60_000) },
        _count: { _all: 3 },
      },
    ]);
    await stale.autoscaler.evaluate(NOW);
    expect(stale.repository.claimReplicaScale).not.toHaveBeenCalled();
  });

  it('does not autoscale manual policies or services with shared storage', async () => {
    const manual = build(service({ replicaPolicy: { ...service().replicaPolicy, strategy: 'manual' } }));
    await manual.autoscaler.evaluate(NOW);
    expect(manual.repository.metricAggregates).not.toHaveBeenCalled();

    const stateful = build(service({ volumePath: '/data' }));
    await stateful.autoscaler.evaluate(NOW);
    expect(stateful.repository.metricAggregates).not.toHaveBeenCalled();
  });

  it('does not reconcile when a concurrent scale update wins the database claim', async () => {
    const { autoscaler, repository, registry, activity } = build();
    repository.claimReplicaScale.mockResolvedValue('conflict');

    await autoscaler.evaluate(NOW);

    expect(registry.reconcileServer).not.toHaveBeenCalled();
    expect(activity.record).not.toHaveBeenCalled();
  });

  it('does not reconcile when the server has no remaining resource capacity', async () => {
    const { autoscaler, repository, registry, activity } = build();
    repository.claimReplicaScale.mockResolvedValue('capacity');

    await autoscaler.evaluate(NOW);

    expect(registry.reconcileServer).not.toHaveBeenCalled();
    expect(activity.record).not.toHaveBeenCalled();
  });
});
