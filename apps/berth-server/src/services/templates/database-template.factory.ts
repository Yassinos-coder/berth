import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  DATABASE_TEMPLATES,
  type DatabaseTemplate,
} from '../../common/database/database-catalog';

export interface GeneratedEnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface GeneratedDatabase {
  image: string;
  tag: string;
  containerPort: number;
  templateKind: string;
  volumeName: string;
  volumePath: string;
  env: GeneratedEnvVar[];
}

export class DatabaseTemplateFactory {
  static isDatabase(kind: string): boolean {
    return Boolean(DATABASE_TEMPLATES[kind]);
  }

  static build(kind: string, serviceName: string): GeneratedDatabase {
    const template = DATABASE_TEMPLATES[kind];
    if (!template) {
      throw new BadRequestException(`Unknown database template "${kind}"`);
    }

    const dbName = this.sanitize(serviceName);
    const password = this.secret();
    const env: GeneratedEnvVar[] = [];

    if (template.usernameEnv) {
      env.push({ key: template.usernameEnv, value: 'berth', isSecret: false });
    }
    if (template.passwordEnv) {
      env.push({ key: template.passwordEnv, value: password, isSecret: true });
    }
    if (template.databaseEnv) {
      env.push({ key: template.databaseEnv, value: dbName, isSecret: false });
    }
    if (template.rootPasswordEnv) {
      env.push({
        key: template.rootPasswordEnv,
        value: this.secret(),
        isSecret: true,
      });
    }

    return {
      image: template.image,
      tag: template.defaultTag,
      containerPort: template.port,
      templateKind: template.kind,
      volumeName: `${dbName}-data`,
      volumePath: template.volumePath,
      env,
    };
  }

  static resolve(kind: string): DatabaseTemplate | undefined {
    return DATABASE_TEMPLATES[kind];
  }

  private static secret(): string {
    return randomBytes(18).toString('hex');
  }

  private static sanitize(name: string): string {
    const cleaned = name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+/, '');
    return cleaned || 'berth_db';
  }
}
