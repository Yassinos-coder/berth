import { useQuery } from '@tanstack/react-query';
import { templatesService } from '@/services/templatesService';
import { queryKeys } from '@/lib/queryClient';

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: () => templatesService.list(),
  });
}
