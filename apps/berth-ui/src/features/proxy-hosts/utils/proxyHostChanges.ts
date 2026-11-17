import type { ProxyHostFormValues } from '@/features/proxy-hosts/schemas/proxyHostSchema';
import type { UpdateProxyHostPayload } from '@/services/proxyHostsService';
import type { ProxyHost } from '@/interfaces';

export class ProxyHostChanges {
  static toFormValues(host: ProxyHost): ProxyHostFormValues {
    return {
      domain: host.domain,
      path: host.path === '/' ? '' : host.path,
      serviceId: host.serviceId,
      targetPort: String(host.targetPort),
      ssl: host.ssl,
      forceHttps: host.forceHttps,
    };
  }

  static diff(
    host: ProxyHost,
    values: ProxyHostFormValues,
  ): UpdateProxyHostPayload {
    const payload: UpdateProxyHostPayload = {};
    const domain = values.domain.trim().toLowerCase();
    const path = values.path.trim() || '/';
    const port = Number(values.targetPort);
    const forceHttps = values.forceHttps && values.ssl;

    if (domain !== host.domain) payload.domain = domain;
    if (path !== host.path) payload.path = path;
    if (values.serviceId !== host.serviceId) payload.serviceId = values.serviceId;
    if (port !== host.targetPort) payload.targetPort = port;
    if (values.ssl !== host.ssl) payload.ssl = values.ssl;
    if (forceHttps !== host.forceHttps) payload.forceHttps = forceHttps;
    return payload;
  }
}
