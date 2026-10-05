import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseCompose } from './compose-parser';

describe('parseCompose', () => {
  it('parses a YAML document with image, ports and list environment', () => {
    const yaml = [
      'services:',
      '  web:',
      '    image: nginx:1.27',
      '    ports:',
      '      - "8080:80"',
      '    environment:',
      '      - FOO=bar',
      '      - URL=http://a?x=1',
    ].join('\n');

    expect(parseCompose(yaml)).toEqual([
      {
        name: 'web',
        image: 'nginx:1.27',
        build: undefined,
        command: undefined,
        environment: [
          { key: 'FOO', value: 'bar' },
          { key: 'URL', value: 'http://a?x=1' },
        ],
        ports: [{ host: 8080, container: 80 }],
      },
    ]);
  });

  it('parses JSON documents and map-style environment', () => {
    const json = JSON.stringify({
      services: { api: { build: { context: './api' }, environment: { A: 1, B: null }, ports: ['3000/tcp'] } },
    });
    const [api] = parseCompose(json);
    expect(api.build).toBe('./api');
    expect(api.environment).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '' },
    ]);
    expect(api.ports).toEqual([{ container: 3000 }]);
  });

  it('wraps a string command in a shell', () => {
    const [svc] = parseCompose(JSON.stringify({ services: { w: { image: 'x', command: 'run it' } } }));
    expect(svc.command).toEqual(['sh', '-lc', 'run it']);
  });

  it('rejects documents without services', () => {
    expect(() => parseCompose('{"version":"3"}')).toThrow(BadRequestException);
  });

  it('rejects non-object services', () => {
    expect(() => parseCompose(JSON.stringify({ services: { a: 'nope' } }))).toThrow(BadRequestException);
  });
});
