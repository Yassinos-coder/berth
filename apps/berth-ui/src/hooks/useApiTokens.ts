import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiTokensService,
  type CreateApiTokenPayload,
} from '@/services/apiTokensService';
import { notify } from '@/lib/toast';

const API_TOKENS_KEY = ['auth', 'api-tokens'];

export function useApiTokens() {
  return useQuery({
    queryKey: API_TOKENS_KEY,
    queryFn: () => apiTokensService.list(),
  });
}

export function useCreateApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateApiTokenPayload) =>
      apiTokensService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: API_TOKENS_KEY }),
    onError: (error) =>
      notify.error('Could not create API token', {
        description: error.message,
      }),
  });
}

export function useRevokeApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiTokensService.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_TOKENS_KEY });
      notify.success('API token revoked');
    },
    onError: (error) =>
      notify.error('Could not revoke API token', {
        description: error.message,
      }),
  });
}
