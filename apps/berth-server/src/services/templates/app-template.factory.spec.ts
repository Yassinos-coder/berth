import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { APP_TEMPLATES } from '../../templates/app-catalog';
import { TEMPLATES } from '../../templates/templates.constants';
import { DatabaseTemplateFactory } from './database-template.factory';
import { AppTemplateFactory } from './app-template.factory';

describe('app catalog', () => {
  it('has unique kinds that do not collide with database templates', () => {
    const kinds = APP_TEMPLATES.map((template) => template.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const kind of kinds) expect(DatabaseTemplateFactory.isDatabase(kind)).toBe(false);
  });

  it('exposes every app in the public template list with unique ids', () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const app of APP_TEMPLATES) {
      expect(TEMPLATES.find((template) => template.kind === app.kind)).toBeDefined();
    }
  });

  it.each(APP_TEMPLATES.map((template) => [template.kind, template] as const))(
    '%s is well formed',
    (_kind, template) => {
      expect(template.image).toMatch(/^[a-z0-9][a-z0-9./_-]*$/);
      expect(template.defaultTag).toMatch(/^\w[\w.-]*$/);
      expect(template.port).toBeGreaterThan(0);
      expect(template.port).toBeLessThan(65536);
      if (template.volumePath) expect(template.volumePath.startsWith('/')).toBe(true);
      for (const env of template.env ?? []) {
        expect(env.key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
        expect(env.generate || env.value !== undefined).toBe(true);
      }
    },
  );
});

describe('AppTemplateFactory', () => {
  it('generates a fresh secret per build', () => {
    const a = AppTemplateFactory.build('grafana', 'dash');
    const b = AppTemplateFactory.build('grafana', 'dash');
    const secretA = a.env.find((item) => item.key === 'GF_SECURITY_ADMIN_PASSWORD')!;
    const secretB = b.env.find((item) => item.key === 'GF_SECURITY_ADMIN_PASSWORD')!;
    expect(secretA.isSecret).toBe(true);
    expect(secretA.value).toHaveLength(36);
    expect(secretA.value).not.toBe(secretB.value);
  });

  it('names the volume after the sanitized service name', () => {
    expect(AppTemplateFactory.build('n8n', 'My Flows!').volumeName).toBe('my_flows_-data');
  });

  it('omits the volume for stateless apps', () => {
    const built = AppTemplateFactory.build('adminer', 'db-ui');
    expect(built.volumeName).toBeUndefined();
    expect(built.volumePath).toBeUndefined();
  });

  it('rejects unknown kinds', () => {
    expect(() => AppTemplateFactory.build('nope', 'x')).toThrow(BadRequestException);
  });
});
