import { describe, expect, it } from 'vitest';
import { TelemetryBuffer } from './telemetry-buffer.service';

const line = (ts: number, text: string, stream: 'stdout' | 'build' = 'stdout') => ({
  id: `${ts}`,
  ts,
  stream,
  line: text,
});

describe('TelemetryBuffer logs', () => {
  it('keeps build output when runtime logs overflow', () => {
    const buffer = new TelemetryBuffer();
    buffer.appendLog('s', line(1, '==> Build started', 'build'));
    for (let i = 2; i < 1200; i += 1) buffer.appendLog('s', line(i, `run ${i}`));
    const logs = buffer.getLogs('s');
    expect(logs.filter((entry) => entry.stream === 'build')).toHaveLength(1);
    expect(logs.filter((entry) => entry.stream === 'stdout')).toHaveLength(500);
  });

  it('replaces the previous build when a new one starts', () => {
    const buffer = new TelemetryBuffer();
    buffer.appendLog('s', line(1, '==> Build started', 'build'));
    buffer.appendLog('s', line(2, 'old step', 'build'));
    buffer.appendLog('s', line(3, '==> Build started', 'build'));
    buffer.appendLog('s', line(4, 'new step', 'build'));
    expect(buffer.getLogs('s').map((entry) => entry.line)).toEqual(['==> Build started', 'new step']);
  });

  it('returns runtime and build lines in time order', () => {
    const buffer = new TelemetryBuffer();
    buffer.appendLog('s', line(5, 'later'));
    buffer.appendLog('s', line(2, 'build step', 'build'));
    expect(buffer.getLogs('s').map((entry) => entry.ts)).toEqual([2, 5]);
  });

  it('clears both buffers', () => {
    const buffer = new TelemetryBuffer();
    buffer.appendLog('s', line(1, 'x'));
    buffer.appendLog('s', line(2, 'y', 'build'));
    buffer.clear('s');
    expect(buffer.getLogs('s')).toEqual([]);
  });
});
