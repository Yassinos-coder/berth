import { describe, expect, it } from 'vitest';
import { EnvText, SECRET_MASK } from './envText';

const existing = [
  { key: 'PORT', value: '3000', isSecret: false },
  { key: 'API_TOKEN', value: 'tok_live_123', isSecret: true },
];

describe('EnvText.serialize', () => {
  it('writes .env text and quotes values that need it', () => {
    const text = EnvText.serialize(
      [
        { key: 'A', value: 'plain', isSecret: false },
        { key: 'B', value: 'has space', isSecret: false },
        { key: 'C', value: '', isSecret: false },
      ],
      'dotenv',
      true,
    );
    expect(text).toBe('A=plain\nB="has space"\nC=""');
  });

  it('writes a JSON object', () => {
    expect(JSON.parse(EnvText.serialize(existing, 'json', true))).toEqual({ PORT: '3000', API_TOKEN: 'tok_live_123' });
  });

  it('hides secret values unless asked', () => {
    expect(EnvText.serialize(existing, 'dotenv', false)).toBe(`PORT=3000\nAPI_TOKEN=${SECRET_MASK}`);
    expect(EnvText.serialize(existing, 'dotenv', false)).not.toContain('tok_live_123');
    expect(EnvText.serialize(existing, 'json', false)).not.toContain('tok_live_123');
  });
});

describe('EnvText.parse', () => {
  it('round-trips both formats', () => {
    for (const format of ['dotenv', 'json'] as const) {
      const text = EnvText.serialize(existing, format, true);
      const { vars, errors } = EnvText.parse(text, format, existing);
      expect(errors).toEqual([]);
      expect(vars).toEqual(existing);
    }
  });

  it('keeps the real secret when the mask is left untouched', () => {
    const { vars, errors } = EnvText.parse(`PORT=8080\nAPI_TOKEN=${SECRET_MASK}`, 'dotenv', existing);
    expect(errors).toEqual([]);
    expect(vars).toEqual([
      { key: 'PORT', value: '8080', isSecret: false },
      { key: 'API_TOKEN', value: 'tok_live_123', isSecret: true },
    ]);
  });

  it('rejects the mask for a variable that does not exist yet', () => {
    const { errors } = EnvText.parse(`NEW_SECRET=${SECRET_MASK}`, 'dotenv', existing);
    expect(errors[0].message).toContain('new variable');
  });

  it('marks new secret-looking keys as secret and keeps flags on existing ones', () => {
    const { vars } = EnvText.parse('DB_PASSWORD=hunter2\nPORT=1', 'dotenv', existing);
    expect(vars.find((v) => v.key === 'DB_PASSWORD')?.isSecret).toBe(true);
    expect(vars.find((v) => v.key === 'PORT')?.isSecret).toBe(false);
  });

  it('reports bad lines with their line numbers', () => {
    const { errors } = EnvText.parse('A=1\nnot a variable\n9BAD=x\nA=2', 'dotenv', []);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it('handles comments, export, quotes and escaped quotes', () => {
    const { vars } = EnvText.parse('# note\nexport A="say \\"hi\\""\nB=\'single\'', 'dotenv', []);
    expect(vars.map((v) => [v.key, v.value])).toEqual([['A', 'say "hi"'], ['B', 'single']]);
  });

  it('explains invalid JSON and wrong shapes', () => {
    expect(EnvText.parse('{ nope', 'json', []).errors[0].message).toContain('Invalid JSON');
    expect(EnvText.parse('[1,2]', 'json', []).errors[0].message).toContain('JSON object');
    expect(EnvText.parse('{"A": {"x": 1}}', 'json', []).errors[0].message).toContain('string, number');
  });

  it('accepts numbers and booleans in JSON as text', () => {
    const { vars } = EnvText.parse('{"PORT": 3000, "DEBUG": true}', 'json', []);
    expect(vars.map((v) => v.value)).toEqual(['3000', 'true']);
  });
});
