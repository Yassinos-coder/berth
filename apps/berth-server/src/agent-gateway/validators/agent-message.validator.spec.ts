import { describe, expect, it } from 'vitest';
import { AgentMessageValidator } from './agent-message.validator';

const frame = (message: object) => JSON.stringify(message);

describe('AgentMessageValidator', () => {
  it.each([
    { type: 'Enrolled' },
    { type: 'ServiceStatus' },
    { type: 'BuildProgress' },
    { type: 'LogChunk' },
    { type: 'Metrics' },
    { type: 'HostUsage' },
    { type: 'ReconcileResult' },
    { type: 'BackupResult' },
    { type: 'RestoreResult' },
    { type: 'ExecOutput' },
    { type: 'ExecExit' },
  ])('accepts $type', (message) => {
    expect(AgentMessageValidator.parse(frame(message))).toEqual(message);
  });

  it('rejects unknown types', () => {
    expect(AgentMessageValidator.parse(frame({ type: 'Nope' }))).toBeNull();
  });

  it('rejects prototype keys used as a type', () => {
    expect(AgentMessageValidator.parse(frame({ type: 'constructor' }))).toBeNull();
    expect(AgentMessageValidator.parse(frame({ type: 'toString' }))).toBeNull();
  });

  it.each(['', 'not json', 'null', '42', '[]', '{"type":5}', '{}'])('rejects %j', (raw) => {
    expect(AgentMessageValidator.parse(raw)).toBeNull();
  });

  it('rejects oversized frames', () => {
    const big = frame({ type: 'LogChunk', line: 'x'.repeat(256 * 1024) });
    expect(AgentMessageValidator.parse(big)).toBeNull();
  });
});
