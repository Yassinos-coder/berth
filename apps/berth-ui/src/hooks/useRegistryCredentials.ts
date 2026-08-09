import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  registryCredentialsService,
  type CreateRegistryCredentialPayload,
} from '@/services/registryCredentialsService';
import { notify } from '@/lib/toast';

const REGISTRY_CREDENTIALS_KEY = ['registry-credentials'];

export function useRegistryCredentials() {
  return useQuery({
    queryKey: REGISTRY_CREDENTIALS_KEY,
    queryFn: () => registryCredentialsService.list(),
  });
}

export function useCreateRegistryCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRegistryCredentialPayload) =>
      registryCredentialsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REGISTRY_CREDENTIALS_KEY });
      notify.success('Registry credential added');
    },
    onError: (error) =>
      notify.error('Could not add registry credential', {
        description: error.message,
      }),
  });
}

export function useRemoveRegistryCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => registryCredentialsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REGISTRY_CREDENTIALS_KEY });
      notify.success('Registry credential removed');
    },
    onError: (error) =>
      notify.error('Could not remove registry credential', {
        description: error.message,
      }),
  });
}
