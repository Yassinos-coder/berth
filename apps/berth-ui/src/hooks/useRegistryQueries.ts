import { useQuery } from '@tanstack/react-query';
import { registryService } from '@/services/registryService';

export function useImageSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['registry', 'search', trimmed],
    queryFn: () => registryService.search(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });
}

export function useImageTags(image: string | undefined) {
  return useQuery({
    queryKey: ['registry', 'tags', image],
    queryFn: () => registryService.tags(image as string),
    enabled: Boolean(image),
    staleTime: 60_000,
  });
}
