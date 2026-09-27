export interface ProxyHostDto {
  id: string;
  domain: string;
  path: string;
  serviceId: string;
  serviceName: string;
  targetPort: number;
  ssl: boolean;
  forceHttps: boolean;
  createdAt: string;
}
