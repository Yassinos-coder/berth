import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { APP_TEMPLATES } from '../../templates/app-catalog';
import type { AppTemplate } from '../../templates/interfaces';
import type { GeneratedEnvVar } from './database-template.factory';

export class AppTemplateFactory {
  static isApp(kind: string): boolean {
    return APP_TEMPLATES.some((template) => template.kind === kind);
  }

  static resolve(kind: string): AppTemplate {
    const template = APP_TEMPLATES.find((item) => item.kind === kind);
    if (!template) {
      throw new BadRequestException(`Unknown app template "${kind}"`);
    }
    return template;
  }

  static build(kind: string, serviceName: string) {
    const template = this.resolve(kind);
    const env: GeneratedEnvVar[] = (template.env ?? []).map((item) => ({
      key: item.key,
      value: item.generate ? this.secret() : (item.value ?? ''),
      isSecret: Boolean(item.isSecret),
    }));
    return {
      image: template.image,
      tag: template.defaultTag,
      containerPort: template.port,
      templateKind: template.kind,
      volumeName: template.volumePath ? `${this.sanitize(serviceName)}-data` : undefined,
      volumePath: template.volumePath,
      env,
      command: template.command ?? [],
    };
  }

  private static secret(): string {
    return randomBytes(18).toString('hex');
  }

  private static sanitize(name: string): string {
    const cleaned = name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+/, '');
    return cleaned || 'berth_app';
  }
}
