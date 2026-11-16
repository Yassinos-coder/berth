import { describe, expect, it } from 'vitest';
import { RequestContext } from './request-context.util';

describe('RequestContext', () => {
  it('is empty outside a request', () => {
    expect(RequestContext.requestId()).toBeUndefined();
  });

  it('follows async work started inside a request', async () => {
    const seen = await RequestContext.run('req-12345678', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return RequestContext.requestId();
    });
    expect(seen).toBe('req-12345678');
  });

  it('keeps concurrent requests separate', async () => {
    const read = (id: string) =>
      RequestContext.run(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
        return RequestContext.requestId();
      });
    expect(await Promise.all([read('aaaaaaaa'), read('bbbbbbbb')])).toEqual([
      'aaaaaaaa',
      'bbbbbbbb',
    ]);
  });
});
