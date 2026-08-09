import { BadRequestException } from '@nestjs/common';

export interface ComposeService {
  name: string;
  image?: string;
  build?: string;
  command?: string[];
  environment: Array<{ key: string; value: string }>;
  ports: Array<{ host?: number; container: number }>;
}

export function parseCompose(document: string): ComposeService[] {
  let source: unknown;
  try { source = JSON.parse(document); } catch { source = parseSimpleYaml(document); }
  if (!source || typeof source !== 'object') throw new BadRequestException('Invalid Compose document');
  const services = (source as { services?: Record<string, unknown> }).services;
  if (!services || typeof services !== 'object') throw new BadRequestException('Compose document has no services');
  return Object.entries(services).map(([name, raw]) => normalize(name, raw));
}

function normalize(name: string, raw: unknown): ComposeService {
  if (!raw || typeof raw !== 'object') throw new BadRequestException(`Invalid service ${name}`);
  const value = raw as Record<string, unknown>;
  const environment: ComposeService['environment'] = [];
  if (Array.isArray(value.environment)) for (const item of value.environment) { const [key, ...rest] = String(item).split('='); environment.push({ key, value: rest.join('=') }); }
  else if (value.environment && typeof value.environment === 'object') for (const [key, item] of Object.entries(value.environment)) environment.push({ key, value: item == null ? '' : String(item) });
  const ports = (Array.isArray(value.ports) ? value.ports : []).map((item) => { const clean = String(item).split('/')[0]; const parts = clean.split(':').map(Number); return parts.length > 1 ? { host: parts.at(-2), container: parts.at(-1)! } : { container: parts[0] }; });
  const command = Array.isArray(value.command) ? value.command.map(String) : typeof value.command === 'string' ? ['sh', '-lc', value.command] : undefined;
  const build = typeof value.build === 'string' ? value.build : value.build && typeof value.build === 'object' ? String((value.build as Record<string, unknown>).context ?? '.') : undefined;
  return { name, image: typeof value.image === 'string' ? value.image : undefined, build, command, environment, ports };
}

// Dependency-free parser for the Compose subset Berth imports. JSON Compose is
// also accepted; anchors and extension fields should be resolved with
// `docker compose config --format json` before import.
function parseSimpleYaml(input: string): Record<string, unknown> {
  const root: Record<string, any> = {};
  const stack: Array<{ indent: number; value: any }> = [{ indent: -1, value: root }];
  const lines = input.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    if (!original.trim() || original.trimStart().startsWith('#')) continue;
    const indent = original.length - original.trimStart().length;
    const line = original.trim();
    while (stack.length > 1 && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1)!.value;
    if (line.startsWith('- ')) {
      if (!Array.isArray(parent)) throw new BadRequestException('Unsupported YAML list placement');
      parent.push(scalar(line.slice(2)));
      continue;
    }
    const split = line.indexOf(':');
    if (split < 0) throw new BadRequestException(`Invalid YAML line: ${line}`);
    const key = line.slice(0, split).trim(); const rest = line.slice(split + 1).trim();
    if (rest) parent[key] = scalar(rest);
    else {
      const next = lines.slice(index + 1).find((candidate) => candidate.trim() && !candidate.trimStart().startsWith('#'));
      parent[key] = next?.trimStart().startsWith('- ') ? [] : {};
      stack.push({ indent, value: parent[key] });
    }
  }
  return root;
}

function scalar(value: string): unknown {
  const clean = value.replace(/^(['"])(.*)\1$/, '$2');
  if (clean === 'true') return true; if (clean === 'false') return false; if (clean === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(clean)) return Number(clean);
  if (clean.startsWith('[') && clean.endsWith(']')) return clean.slice(1, -1).split(',').map((item) => scalar(item.trim()));
  return clean;
}
