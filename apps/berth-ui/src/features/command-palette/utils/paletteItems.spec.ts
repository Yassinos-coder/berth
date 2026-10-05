import { describe, expect, it } from 'vitest';
import { PaletteItems } from '@/features/command-palette/utils/paletteItems';

const items = PaletteItems.build({
  services: [
    { id: 's1', name: 'storefront', state: 'running' },
    { id: 's2', name: 'api-store', state: 'stopped' },
  ],
  servers: [{ id: 'v1', name: 'edge-1' }],
});

const labels = (query: string) => PaletteItems.filter(items, query).map((item) => item.label);

describe('PaletteItems', () => {
  it('includes actions, pages, services and servers', () => {
    const groups = new Set(items.map((item) => item.group));
    expect([...groups].sort()).toEqual(['Actions', 'Pages', 'Servers', 'Services']);
  });

  it('links services and servers to their detail routes', () => {
    expect(items.find((item) => item.id === 'service:s1')?.to).toBe('/services/s1');
    expect(items.find((item) => item.id === 'server:v1')?.to).toBe('/servers/v1');
  });

  it('ranks prefix matches above substring matches', () => {
    const result = labels('store');
    expect(result.indexOf('storefront')).toBeLessThan(result.indexOf('api-store'));
  });

  it('requires every token to match', () => {
    expect(labels('store api')).toEqual(['api-store']);
    expect(labels('store zzz')).toEqual([]);
  });

  it('matches keywords, not just labels', () => {
    expect(labels('dark')).toContain('Toggle theme');
  });

  it('shows the first entries for an empty query and respects the limit', () => {
    expect(PaletteItems.filter(items, '  ', 3)).toHaveLength(3);
  });
});
