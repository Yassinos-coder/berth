import { useQuery } from '@tanstack/react-query';
import { BaseApiClient } from '@/services/baseApiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Event { id: string; actorId: string; action: string; resource: string; ip: string; createdAt: string }
class Api extends BaseApiClient { protected resource = 'audit-events'; list() { return this.get<Event[]>(); } } const api = new Api();
export function AuditLog() {
  const query = useQuery({ queryKey: ['audit-events'], queryFn: () => api.list() });
  return <Card><CardHeader><CardTitle className="text-base">Security audit log</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>IP</TableHead></TableRow></TableHeader><TableBody>{query.data?.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</TableCell><TableCell className="font-mono text-xs">{event.actorId}</TableCell><TableCell className="uppercase">{event.action}</TableCell><TableCell className="font-mono text-xs">{event.resource}</TableCell><TableCell>{event.ip || '—'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}
