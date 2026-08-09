import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { BaseApiClient } from '@/services/baseApiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notify } from '@/lib/toast';

interface JobRun { id: string; status: string; output: string; exitCode?: number; createdAt: string }
interface Job { id: string; name: string; cron: string; timezone: string; command: string[]; runs: JobRun[] }

class JobsApi extends BaseApiClient {
  protected resource = 'services';
  list(serviceId: string) { return this.get<Job[]>(`/${serviceId}/jobs`); }
  create(serviceId: string, data: { name: string; cron: string; timezone: string; command: string[] }) { return this.post<Job>(`/${serviceId}/jobs`, data); }
  run(serviceId: string, command: string[]) { return this.post<JobRun>(`/${serviceId}/jobs/run`, { command }); }
  runJob(serviceId: string, id: string) { return this.post<JobRun>(`/${serviceId}/jobs/${id}/run`, {}); }
  remove(serviceId: string, id: string) { return this.delete<void>(`/${serviceId}/jobs/${id}`); }
}
const api = new JobsApi();

export function JobsPanel({ serviceId }: { serviceId: string }) {
  const qc = useQueryClient();
  const key = ['services', serviceId, 'jobs'];
  const jobs = useQuery({ queryKey: key, queryFn: () => api.list(serviceId), refetchInterval: 5000 });
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [cron, setCron] = useState('0 * * * *');
  const [timezone, setTimezone] = useState('UTC');
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const create = useMutation({ mutationFn: () => api.create(serviceId, { name, cron, timezone, command: ['sh', '-lc', command] }), onSuccess: () => { setName(''); setCommand(''); refresh(); notify.success('Scheduled job created'); }, onError: (error) => notify.error('Could not create job', { description: error.message }) });
  const run = useMutation({ mutationFn: (value: string) => api.run(serviceId, ['sh', '-lc', value]), onSuccess: refresh, onError: (error) => notify.error('Command failed to start', { description: error.message }) });
  const runJob = useMutation({ mutationFn: (id: string) => api.runJob(serviceId, id), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.remove(serviceId, id), onSuccess: refresh });

  return <div className="space-y-4">
    <Card><CardHeader><CardTitle>One-off command</CardTitle></CardHeader><CardContent className="flex gap-2">
      <Input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="npm run migrate" className="font-mono" />
      <Button disabled={!command.trim() || run.isPending} onClick={() => run.mutate(command)}>{run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Scheduled jobs</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Hourly cleanup" /></div>
        <div><Label>Command</Label><Input value={command} onChange={(event) => setCommand(event.target.value)} className="font-mono" /></div>
        <div><Label>Cron (five fields)</Label><Input value={cron} onChange={(event) => setCron(event.target.value)} className="font-mono" /></div>
        <div><Label>Timezone</Label><Input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" /></div>
      </div>
      <Button disabled={!name.trim() || !command.trim() || create.isPending} onClick={() => create.mutate()}><Plus className="size-4" /> Add schedule</Button>
      <div className="space-y-3">{jobs.data?.map((job) => <div key={job.id} className="rounded-md border p-3">
        <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{job.name}</p><p className="text-muted-foreground font-mono text-xs">{job.cron} · {job.timezone} · {job.command.join(' ')}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => runJob.mutate(job.id)}><Play className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => remove.mutate(job.id)}><Trash2 className="text-destructive size-4" /></Button></div></div>
        {job.runs[0] ? <div className="mt-2 rounded bg-muted p-2 text-xs"><span className="font-medium">{job.runs[0].status}</span>{job.runs[0].output ? <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">{job.runs[0].output}</pre> : null}</div> : null}
      </div>)}</div>
    </CardContent></Card>
  </div>;
}
