export interface ReferenceEnv {
  key: string;
  value: string;
}

export interface ReferenceTarget {
  name: string;
  containerPort: number | null;
  env: ReferenceEnv[];
}

const REFERENCE_PATTERN = /\$\{\{\s*([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)\s*\}\}/g;

export class EnvReferenceResolver {
  static index(targets: ReferenceTarget[]): Map<string, ReferenceTarget> {
    return new Map(targets.map((target) => [target.name, target]));
  }

  static resolve(value: string, targets: Map<string, ReferenceTarget>): string {
    return value.replace(REFERENCE_PATTERN, (match, serviceName: string, variable: string) => {
      const target = targets.get(serviceName);
      if (!target) return match;
      return EnvReferenceResolver.lookup(target, variable) ?? match;
    });
  }

  private static lookup(target: ReferenceTarget, variable: string): string | undefined {
    if (variable === 'HOST') return target.name;
    if (variable === 'PORT') return target.containerPort ? String(target.containerPort) : undefined;
    return target.env.find((item) => item.key === variable)?.value;
  }
}
