import { describe, expect, it, vi } from 'vitest';
import { ServersService } from './servers.service';

const FINGERPRINT = 'ab'.repeat(32);
const user = { id: 'user-1', orgId: 'org-1' } as never;

function build(config: Record<string, string>) {
  const repository = {
    createEnrolling: vi.fn().mockResolvedValue({}),
    regenerateBootstrap: vi.fn().mockResolvedValue({ id: 'srv-1', name: 'srv' }),
  };
  const activity = { record: vi.fn().mockResolvedValue(undefined) };
  const configService = { get: (key: string) => config[key] };
  const ca = { caFingerprint: () => FINGERPRINT };
  const service = new ServersService(
    repository as never,
    activity as never,
    configService as never,
    ca as never,
  );
  return { service, repository };
}

const CONFIG = {
  publicPanelUrl: 'wss://panel.example.com:4443',
  agentInstallUrl: 'https://example.github.io/berth/agent-install.sh',
};

describe('ServersService add-server command', () => {
  it('carries the CA fingerprint so a remote server can verify the panel', async () => {
    const { service } = build(CONFIG);

    const { installCommand } = await service.enroll(user, 'asia-1');

    expect(installCommand).toContain(`BERTH_CA_SHA256='${FINGERPRINT}'`);
    expect(installCommand).toContain("BERTH_PANEL_URL='wss://panel.example.com:4443'");
    expect(installCommand).toContain('agent-install.sh');
    expect(installCommand).toMatch(/BERTH_BOOTSTRAP='[A-Za-z0-9_-]+'/);
  });

  it('also includes it when a server is re-enrolled', async () => {
    const { service } = build(CONFIG);

    const { installCommand } = await service.reenroll(user, 'srv-1');

    expect(installCommand).toContain(`BERTH_CA_SHA256='${FINGERPRINT}'`);
  });

  it('issues a different one-time token each time', async () => {
    const { service } = build(CONFIG);

    const first = await service.enroll(user, 'a');
    const second = await service.enroll(user, 'b');

    expect(first.token).not.toBe(second.token);
  });
});
