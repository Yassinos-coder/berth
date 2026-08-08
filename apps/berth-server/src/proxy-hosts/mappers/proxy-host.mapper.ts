import { ProxyHostWithService } from '../repositories/proxy-host.repository';
import type { ProxyHostDto } from '../interfaces';

export class ProxyHostMapper {
  static toDto(host: ProxyHostWithService): ProxyHostDto {
    return {
      id: host.id,
      domain: host.domain,
      serviceId: host.serviceId,
      serviceName: host.service.name,
      targetPort: host.targetPort,
      ssl: host.ssl,
      forceHttps: host.forceHttps,
      createdAt: host.createdAt.toISOString(),
    };
  }
}
