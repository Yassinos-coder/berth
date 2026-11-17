import type { AdvisorFindingKind, AdvisorSeverity } from '@berth/protocol';
import type { CandidateFinding } from '../interfaces';
import { FindingActionValidator } from '../validators/finding-action.validator';

const KINDS: AdvisorFindingKind[] = ['resources', 'storage', 'reliability', 'security', 'cost', 'config'];
const SEVERITIES: AdvisorSeverity[] = ['info', 'warning', 'critical'];
const MAX_AI_FINDINGS = 5;
const TITLE_MAX = 120;
const DETAIL_MAX = 600;

export interface ParseResult {
  findings: CandidateFinding[];
  dropped: number;
}

export class AdvisorOutputParser {
  static sanitize(text: unknown, max: number): string {
    if (typeof text !== 'string') return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\bhttps?:\/\/\S+/gi, '[link removed]')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, max);
  }

  static extractJson(text: string): unknown {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    const source = fenced ? fenced[1] : text;
    const start = source.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(start, index + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  static merge(
    modelText: string,
    candidates: CandidateFinding[],
    knownServiceIds: ReadonlySet<string>,
  ): ParseResult {
    const parsed = AdvisorOutputParser.extractJson(modelText) as { findings?: unknown } | null;
    const items = Array.isArray(parsed?.findings) ? (parsed!.findings as unknown[]) : [];
    const byFingerprint = new Map(candidates.map((candidate) => [candidate.fingerprint, { ...candidate }]));
    const added: CandidateFinding[] = [];
    let dropped = 0;

    for (const item of items) {
      if (typeof item !== 'object' || item === null) {
        dropped += 1;
        continue;
      }
      const raw = item as Record<string, unknown>;
      const fingerprint = typeof raw.fingerprint === 'string' ? raw.fingerprint.slice(0, 120) : '';
      const title = AdvisorOutputParser.sanitize(raw.title, TITLE_MAX);
      const detail = AdvisorOutputParser.sanitize(raw.detail, DETAIL_MAX);

      const existing = byFingerprint.get(fingerprint);
      if (existing) {
        if (title) existing.title = title;
        if (detail) existing.detail = detail;
        continue;
      }

      const valid =
        fingerprint.startsWith('ai:') &&
        title &&
        detail &&
        KINDS.includes(raw.kind as AdvisorFindingKind) &&
        SEVERITIES.includes(raw.severity as AdvisorSeverity) &&
        added.length < MAX_AI_FINDINGS;
      if (!valid) {
        dropped += 1;
        continue;
      }

      const serviceId =
        typeof raw.serviceId === 'string' && knownServiceIds.has(raw.serviceId) ? raw.serviceId : undefined;
      const action = FindingActionValidator.parse(raw.action);
      const usable = action && knownServiceIds.has(action.serviceId) && !FindingActionValidator.boundsError(action);

      added.push({
        fingerprint,
        kind: raw.kind as AdvisorFindingKind,
        severity: raw.severity as AdvisorSeverity,
        source: 'ai',
        title,
        detail,
        evidence: [],
        ...(serviceId ? { serviceId } : {}),
        ...(usable ? { action } : {}),
      });
    }

    return { findings: [...byFingerprint.values(), ...added], dropped };
  }
}
