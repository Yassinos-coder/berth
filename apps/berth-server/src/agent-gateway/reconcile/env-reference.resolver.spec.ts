import { describe, expect, it } from 'vitest';
import { EnvReferenceResolver, ReferenceTarget } from './env-reference.resolver';

const redis: ReferenceTarget = {
  name: 'redis-shared',
  containerPort: 6379,
  env: [{ key: 'REDIS_PASSWORD', value: 's3cret' }],
};

const targets = EnvReferenceResolver.index([redis]);

describe('EnvReferenceResolver', () => {
  it('resolves another service variable', () => {
    expect(EnvReferenceResolver.resolve('${{redis-shared.REDIS_PASSWORD}}', targets)).toBe('s3cret');
  });

  it('resolves HOST and PORT', () => {
    expect(
      EnvReferenceResolver.resolve(
        'redis://:${{redis-shared.REDIS_PASSWORD}}@${{redis-shared.HOST}}:${{redis-shared.PORT}}',
        targets,
      ),
    ).toBe('redis://:s3cret@redis-shared:6379');
  });

  it('tolerates spaces inside the braces', () => {
    expect(EnvReferenceResolver.resolve('${{ redis-shared.HOST }}', targets)).toBe('redis-shared');
  });

  it.each([
    '${{missing.HOST}}',
    '${{redis-shared.NOPE}}',
    '${{redis-shared}}',
  ])('leaves %s untouched so the mistake stays visible', (value) => {
    expect(EnvReferenceResolver.resolve(value, targets)).toBe(value);
  });

  it('leaves PORT untouched when the service has no port', () => {
    const portless = EnvReferenceResolver.index([{ ...redis, containerPort: null }]);
    expect(EnvReferenceResolver.resolve('${{redis-shared.PORT}}', portless)).toBe(
      '${{redis-shared.PORT}}',
    );
  });

  it('does not resolve references inside a referenced value', () => {
    const chained = EnvReferenceResolver.index([
      { name: 'a', containerPort: null, env: [{ key: 'X', value: '${{b.Y}}' }] },
      { name: 'b', containerPort: null, env: [{ key: 'Y', value: 'deep' }] },
    ]);
    expect(EnvReferenceResolver.resolve('${{a.X}}', chained)).toBe('${{b.Y}}');
  });

  it('leaves plain values alone', () => {
    expect(EnvReferenceResolver.resolve('postgres://user:pass@host/db', targets)).toBe(
      'postgres://user:pass@host/db',
    );
  });
});
