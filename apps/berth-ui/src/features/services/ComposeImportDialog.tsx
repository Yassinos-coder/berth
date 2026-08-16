import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2 } from 'lucide-react';
import { BaseApiClient } from '@/services/baseApiClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useServers } from '@/hooks/useServersQueries';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

class ComposeApi extends BaseApiClient { protected resource = 'compose'; import(document: string, serverId: string) { return this.post<Array<{ id: string }>>('/import', { document, serverId }); } }
const api = new ComposeApi();

export function ComposeImportDialog() {
  const [open, setOpen] = useState(false); const [document, setDocument] = useState(''); const [serverId, setServerId] = useState('');
  const servers = useServers(); const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => api.import(document, serverId), onSuccess: (rows) => { qc.invalidateQueries({ queryKey: queryKeys.services }); setOpen(false); notify.success(`Imported ${rows.length} service(s)`); }, onError: (error) => notify.error('Compose import failed', { description: error.message }) });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><FileUp className="size-4" aria-hidden="true" /> Import Compose</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Import Docker Compose</DialogTitle><DialogDescription>Image-based services, environment variables, commands, and exposed ports are imported.</DialogDescription></DialogHeader>
    <div className="space-y-3"><div><Label>Target server</Label><Select value={serverId} onValueChange={setServerId}><SelectTrigger><SelectValue placeholder="Select server" /></SelectTrigger><SelectContent>{servers.data?.map((server) => <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>compose.yaml</Label><Textarea className="min-h-72 font-mono" value={document} onChange={(event) => setDocument(event.target.value)} placeholder={'services:\n  web:\n    image: nginx:latest\n    ports:\n      - "80:80"'} /></div>
    <Button disabled={!serverId || !document.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />} Import services</Button></div>
  </DialogContent></Dialog>;
}
