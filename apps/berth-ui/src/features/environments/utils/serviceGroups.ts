import type { Service } from '@/interfaces';
import type { Environment } from '@/services/environmentsService';

export interface ServiceGroup {
  id: string | null;
  name: string;
  isProduction: boolean;
  preview: boolean;
  services: Service[];
}

export class ServiceGroups {
  static group(services: Service[], environments: Environment[]): ServiceGroup[] {
    const known = new Map(environments.map((environment) => [environment.id, environment]));
    const buckets = new Map<string | null, Service[]>();

    for (const service of services) {
      const key = service.environmentId && known.has(service.environmentId) ? service.environmentId : null;
      buckets.set(key, [...(buckets.get(key) ?? []), service]);
    }

    const groups: ServiceGroup[] = [...known.values()]
      .filter((environment) => buckets.has(environment.id))
      .sort(
        (a, b) =>
          Number(b.isProduction) - Number(a.isProduction) ||
          Number(a.preview) - Number(b.preview) ||
          a.name.localeCompare(b.name),
      )
      .map((environment) => ({
        id: environment.id,
        name: environment.name,
        isProduction: environment.isProduction,
        preview: environment.preview,
        services: buckets.get(environment.id) ?? [],
      }));

    const unassigned = buckets.get(null);
    if (unassigned) {
      groups.push({ id: null, name: 'No environment', isProduction: false, preview: false, services: unassigned });
    }
    return groups;
  }

  static hasAssignments(services: Service[], environments: Environment[]): boolean {
    const ids = new Set(environments.map((environment) => environment.id));
    return services.some((service) => Boolean(service.environmentId && ids.has(service.environmentId)));
  }
}
