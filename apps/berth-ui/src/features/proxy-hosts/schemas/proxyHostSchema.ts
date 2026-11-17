import { z } from 'zod';

const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const PATH = /^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@%/]*$/;

export const proxyHostSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, 'Enter a domain')
    .regex(
      DOMAIN,
      'Enter a valid domain, e.g. app.example.com (no https:// and no path)',
    ),
  path: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || value === '/' || PATH.test(value),
      'A path starts with / and uses URL-safe characters, e.g. /api',
    ),
  serviceId: z.string().min(1, 'Choose a service'),
  targetPort: z
    .string()
    .refine((value) => {
      const port = Number(value);
      return Number.isInteger(port) && port >= 1 && port <= 65535;
    }, 'Use a port between 1 and 65535'),
  ssl: z.boolean(),
  forceHttps: z.boolean(),
});

export type ProxyHostFormValues = z.infer<typeof proxyHostSchema>;

export const emptyProxyHostValues = (
  serviceId: string,
): ProxyHostFormValues => ({
  domain: '',
  path: '',
  serviceId,
  targetPort: '80',
  ssl: true,
  forceHttps: true,
});
