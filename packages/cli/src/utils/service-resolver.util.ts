import type { ServiceSummary } from '@/interfaces';

export class ServiceResolverUtil {
  static resolve(services: ServiceSummary[], reference: string): ServiceSummary {
    const needle = reference.trim();
    if (!needle) throw new Error('Service name or id is required');

    const exact = services.find((service) => service.id === needle);
    if (exact) return exact;

    const lowered = needle.toLowerCase();
    const byName = services.filter((service) => service.name.toLowerCase() === lowered);
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) {
      throw new Error(`"${needle}" matches ${byName.length} services; use the id instead`);
    }

    const byPrefix = services.filter(
      (service) => service.id.startsWith(needle) || service.name.toLowerCase().startsWith(lowered),
    );
    if (byPrefix.length === 1) return byPrefix[0];
    if (byPrefix.length > 1) {
      throw new Error(
        `"${needle}" is ambiguous: ${byPrefix.map((service) => service.name).join(', ')}`,
      );
    }
    throw new Error(`No service matches "${needle}"`);
  }
}
