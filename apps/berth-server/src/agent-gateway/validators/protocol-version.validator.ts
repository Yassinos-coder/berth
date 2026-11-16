import { MIN_SUPPORTED_AGENT_PROTOCOL, PROTOCOL_VERSION } from '@berth/protocol';

const LEGACY_AGENT_PROTOCOL = 1;

export class ProtocolVersionValidator {
  static check(raw: string | null): string | null {
    const version = raw === null ? LEGACY_AGENT_PROTOCOL : Number(raw);
    if (!Number.isInteger(version) || version < 1) {
      return 'invalid protocol version';
    }
    if (version < MIN_SUPPORTED_AGENT_PROTOCOL) {
      return `agent protocol ${version} is too old; upgrade the agent (panel requires >= ${MIN_SUPPORTED_AGENT_PROTOCOL})`;
    }
    if (version > PROTOCOL_VERSION) {
      return `agent protocol ${version} is newer than the panel (${PROTOCOL_VERSION}); upgrade the panel`;
    }
    return null;
  }
}
