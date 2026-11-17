import type { EdgeStatEntry } from '@berth/protocol';

const MAX_REQUESTS_PER_MINUTE = 5_000_000;
const MAX_LATENCY_MS = 10 * 60_000;

export class EdgeEntryValidator {
  static sane(entry: EdgeStatEntry): boolean {
    if (typeof entry?.domain !== 'string' || entry.domain.length === 0 || entry.domain.length > 253) return false;
    const counts = [entry.requests, entry.status4xx, entry.status5xx, entry.p95Ms];
    if (!counts.every((value) => Number.isInteger(value) && value >= 0)) return false;
    if (entry.requests === 0 || entry.requests > MAX_REQUESTS_PER_MINUTE) return false;
    if (entry.status4xx + entry.status5xx > entry.requests) return false;
    return entry.p95Ms <= MAX_LATENCY_MS;
  }
}
