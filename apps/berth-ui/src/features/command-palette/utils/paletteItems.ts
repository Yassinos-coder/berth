import { NAV_SECTIONS } from '@/layout/nav';
import type { PaletteItem } from '@/features/command-palette/types';

export class PaletteItems {
  static build(input: {
    services: { id: string; name: string; state: string }[];
    servers: { id: string; name: string }[];
  }): PaletteItem[] {
    const pages = NAV_SECTIONS.flatMap((section) => section.items).map<PaletteItem>((item) => ({
      id: `page:${item.to}`,
      group: 'Pages',
      label: item.label,
      to: item.to,
      keywords: '',
    }));

    const actions: PaletteItem[] = [
      { id: 'action:new-service', group: 'Actions', label: 'New service', to: '/services/new', keywords: 'create deploy add' },
      { id: 'action:theme', group: 'Actions', label: 'Toggle theme', action: 'toggle-theme', keywords: 'dark light mode' },
    ];

    const services = input.services.map<PaletteItem>((service) => ({
      id: `service:${service.id}`,
      group: 'Services',
      label: service.name,
      hint: service.state,
      to: `/services/${service.id}`,
      keywords: '',
    }));

    const servers = input.servers.map<PaletteItem>((server) => ({
      id: `server:${server.id}`,
      group: 'Servers',
      label: server.name,
      to: `/servers/${server.id}`,
      keywords: '',
    }));

    return [...actions, ...pages, ...services, ...servers];
  }

  static filter(items: PaletteItem[], query: string, limit = 30): PaletteItem[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items.slice(0, limit);

    return items
      .map((item) => ({ item, score: PaletteItems.score(item, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.item);
  }

  private static score(item: PaletteItem, tokens: string[]): number {
    const label = item.label.toLowerCase();
    const haystack = `${label} ${item.keywords} ${item.group.toLowerCase()}`;
    let total = 0;
    for (const token of tokens) {
      if (label.startsWith(token)) total += 3;
      else if (label.includes(token)) total += 2;
      else if (haystack.includes(token)) total += 1;
      else return 0;
    }
    return total;
  }
}
