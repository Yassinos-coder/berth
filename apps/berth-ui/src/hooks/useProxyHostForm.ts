import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  proxyHostSchema,
  type ProxyHostFormValues,
} from '@/features/proxy-hosts/schemas/proxyHostSchema';

export function useProxyHostForm(defaultValues: ProxyHostFormValues) {
  return useForm<ProxyHostFormValues>({
    resolver: zodResolver(proxyHostSchema),
    defaultValues,
    mode: 'onChange',
  });
}
