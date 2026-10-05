import type { AgentToPanel } from '@berth/protocol';

const MAX_MESSAGE_BYTES = 256 * 1024;

const KNOWN_TYPES: Record<AgentToPanel['type'], true> = {
  Enrolled: true,
  ServiceStatus: true,
  BuildProgress: true,
  LogChunk: true,
  Metrics: true,
  HostUsage: true,
  ReconcileResult: true,
  BackupResult: true,
  RestoreResult: true,
  ExecOutput: true,
  ExecExit: true,
};

export class AgentMessageValidator {
  static parse(raw: string): AgentToPanel | null {
    if (!raw || raw.length > MAX_MESSAGE_BYTES) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) return null;

    const type = (parsed as { type?: unknown }).type;
    if (typeof type !== 'string') return null;
    if (!Object.prototype.hasOwnProperty.call(KNOWN_TYPES, type)) return null;

    return parsed as AgentToPanel;
  }
}
