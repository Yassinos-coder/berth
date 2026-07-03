import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResourceLimitsField } from '@/features/services/ResourceLimitsField';
import {
  SOURCE_OPTIONS,
  type SourceChoice,
} from '@/features/services/newServiceOptions';
import { useServers } from '@/hooks/useServersQueries';
import { useCreateService } from '@/hooks/useServicesMutations';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { ResourceLimits, ServiceSource } from '@/interfaces';

export function NewServicePage() {
  const navigate = useNavigate();
  const servers = useServers();
  const createService = useCreateService();

  const [choice, setChoice] = useState<SourceChoice | null>(null);
  const [name, setName] = useState('');
  const [serverId, setServerId] = useState('');
  const [reference, setReference] = useState('');
  const [branch, setBranch] = useState('main');
  const [domain, setDomain] = useState('');
  const [resources, setResources] = useState<ResourceLimits>({
    cpuCores: 1,
    memoryMb: 1024,
  });

  const option = SOURCE_OPTIONS.find((o) => o.id === choice);
  const isGit = choice === 'git';

  const buildSource = (): ServiceSource => {
    if (isGit) {
      return {
        kind: 'git',
        repo: reference,
        branch,
        build: { builder: 'auto' },
      };
    }
    const [image, tag = 'latest'] = reference.split(':');
    return { kind: 'image', image, tag };
  };

  const submit = () => {
    if (!option) return;
    if (!name.trim()) return notify.warn('Give your service a name');
    if (!serverId) return notify.warn('Pick a server to deploy on');
    if (!reference.trim())
      return notify.warn(isGit ? 'Enter a repository' : 'Enter an image');

    createService.mutate(
      {
        name: name.trim(),
        kind: option.kind,
        serverId,
        source: buildSource(),
        resources,
        domain: domain.trim() || undefined,
      },
      { onSuccess: () => navigate('/services') },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/services">
            <ArrowLeft className="size-4" /> Services
          </Link>
        </Button>
        <PageHeader
          title="New service"
          description="Pick a source — every option is just a pre-filled ServiceSpec."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setChoice(opt.id)}
            className={cn(
              'group hover:border-primary/50 relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors',
              choice === opt.id && 'border-primary ring-primary/30 ring-2',
            )}
          >
            {choice === opt.id ? (
              <span className="bg-primary text-primary-foreground absolute top-3 right-3 flex size-5 items-center justify-center rounded-full">
                <Check className="size-3" />
              </span>
            ) : null}
            <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
              <opt.icon className="size-4.5" />
            </span>
            <span className="font-medium">{opt.title}</span>
            <span className="text-muted-foreground text-xs leading-snug">
              {opt.description}
            </span>
          </button>
        ))}
      </div>

      {option ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Service name</Label>
              <Input
                id="name"
                placeholder="my-service"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref">
                {isGit ? 'Repository (owner/repo)' : 'Image (name:tag)'}
              </Label>
              <Input
                id="ref"
                placeholder={isGit ? 'castr/core-api' : 'postgres:16-alpine'}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {isGit ? (
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Target server</Label>
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      servers.isLoading ? 'Loading servers…' : 'Select a server'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(servers.data ?? [])
                    .filter((s) => s.status !== 'enrolling')
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.region}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input
                id="domain"
                placeholder="app.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            <ResourceLimitsField value={resources} onChange={setResources} />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link to="/services">Cancel</Link>
              </Button>
              <Button onClick={submit} disabled={createService.isPending}>
                {createService.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Create service
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
