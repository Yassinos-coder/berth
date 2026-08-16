import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus } from 'lucide-react';
import { BaseApiClient } from '@/services/baseApiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useServices } from '@/hooks/useServicesQueries';
interface Page { id: string; title: string; slug: string; serviceIds: string[] }
class Api extends BaseApiClient { protected resource = 'status-pages'; list() { return this.get<Page[]>(); } create(title: string, slug: string, serviceIds: string[]) { return this.post<Page>('', { title, slug, description: '', serviceIds }); } } const api = new Api();
export function StatusPagesSettings() {
  const [title, setTitle] = useState(''); const [slug, setSlug] = useState(''); const services = useServices(); const qc = useQueryClient(); const key = ['status-pages']; const pages = useQuery({ queryKey: key, queryFn: () => api.list() }); const create = useMutation({ mutationFn: () => api.create(title, slug, (services.data ?? []).map((service) => service.id)), onSuccess: () => { setTitle(''); setSlug(''); qc.invalidateQueries({ queryKey: key }); } });
  return <Card><CardHeader><CardTitle className="text-base">Public status pages</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Input className="max-w-xs" placeholder="Acme status" value={title} onChange={(event) => { setTitle(event.target.value); if (!slug) setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} /><Input className="max-w-xs" placeholder="acme" value={slug} onChange={(event) => setSlug(event.target.value)} /><Button disabled={!title || !slug} onClick={() => create.mutate()}><Plus className="size-4" aria-hidden="true" /> Publish all services</Button></div><div className="divide-y rounded border">{pages.data?.map((page) => <div key={page.id} className="flex justify-between p-3"><span>{page.title} <span className="text-muted-foreground">({page.serviceIds.length} services)</span></span><Button asChild variant="ghost" size="sm"><a href={`/status/${page.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" aria-hidden="true" /> View</a></Button></div>)}</div></CardContent></Card>;
}
