export interface ProxyHostDto {
  id: string;
  domain: string;
  serviceId: string;
  serviceName: string;
  targetPort: number;
  ssl: boolean;
  forceHttps: boolean;
  createdAt: string;
}
