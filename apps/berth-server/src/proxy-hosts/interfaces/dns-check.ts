export type DnsCheckStatus = 'ok' | 'mismatch' | 'unresolved' | 'unknown';

export interface DnsCheckDto {
  status: DnsCheckStatus;
  domain: string;
  expectedIp?: string;
  resolved: string[];
  message: string;
}
