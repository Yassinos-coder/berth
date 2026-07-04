import type { AgentToPanel } from '@berth/protocol';

const MAX_MESSAGE_BYTES = 256 * 1024;

const KNOWN_TYPES = new Set<AgentToPanel['type']>([
  'Enrolled',
  'ServiceStatus',
  'BuildProgress',
  'LogChunk',
  'Metrics',
  'ReconcileResult',
]);

export class AgentMessageValidator {
  static parse(raw: string): AgentToPanel | null {
    if (!raw || raw.length > MAX_MESSAGE_BYTES) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('type' in parsed) ||
      typeof (parsed as { type: unknown }).type !== 'string' ||
      !KNOWN_TYPES.has((parsed as AgentToPanel).type)
    ) {
      return null;
    }

    return parsed as AgentToPanel;
  }
}
