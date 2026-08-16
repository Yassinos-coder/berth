import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { BaseApiClient } from '@/services/baseApiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface Environment { id: string; name: string; slug: string; isProduction: boolean; preview: boolean; _count: { services: number } }
class EnvironmentsApi extends BaseApiClient { protected resource = 'environments'; list() { return this.get<Environment[]>(); } create(name: string, preview: boolean) { return this.post<Environment>('', { name, preview, isProduction: name.toLowerCase() === 'production' }); } remove(id: string) { return this.delete<void>(`/${id}`); } }
const api = new EnvironmentsApi();

export function EnvironmentsSettings() {
  const [name, setName] = useState(''); const [preview, setPreview] = useState(false); const qc = useQueryClient(); const key = ['environments'];
  const query = useQuery({ queryKey: key, queryFn: () => api.list() });
  const create = useMutation({ mutationFn: () => api.create(name, preview), onSuccess: () => { setName(''); setPreview(false); qc.invalidateQueries({ queryKey: key }); } });
  const remove = useMutation({ mutationFn: (id: string) => api.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  return <Card><CardHeader><CardTitle className="text-base">Environments</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Input className="max-w-xs" value={name} onChange={(event) => setName(event.target.value)} placeholder="Staging" /><label className="flex items-center gap-2 text-sm"><Switch checked={preview} onCheckedChange={setPreview} /> PR preview</label><Button disabled={!name.trim()} onClick={() => create.mutate()}><Plus className="size-4" aria-hidden="true" /> Add</Button></div>
    <div className="divide-y rounded-md border">{query.data?.map((environment) => <div key={environment.id} className="flex items-center justify-between p-3"><div><span className="font-medium">{environment.name}</span> <span className="text-muted-foreground text-sm">/{environment.slug}</span><div className="mt-1 flex gap-1">{environment.isProduction ? <Badge>Production</Badge> : null}{environment.preview ? <Badge variant="secondary">Preview</Badge> : null}<Badge variant="outline">{environment._count.services} services</Badge></div></div><Button variant="ghost" size="icon" disabled={environment._count.services > 0} onClick={() => remove.mutate(environment.id)}><Trash2 className="text-destructive size-4" aria-hidden="true" /></Button></div>)}</div>
  </CardContent></Card>;
}
