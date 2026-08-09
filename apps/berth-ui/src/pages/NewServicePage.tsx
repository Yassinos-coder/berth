import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Database, Globe, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResourceLimitsField } from '@/features/services/ResourceLimitsField';
import { ImageSearch } from '@/features/services/ImageSearch';
import {
  SOURCE_OPTIONS,
  type SourceChoice,
} from '@/features/services/newServiceOptions';
import { useServers } from '@/hooks/useServersQueries';
import { useCreateService } from '@/hooks/useServicesMutations';
import { useGithubBranches, useGithubRepos, useGithubStatus } from '@/hooks/useGithubQueries';
import { useTemplates } from '@/hooks/useTemplatesQueries';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { RegistryImage, ResourceLimits } from '@/interfaces';

export function NewServicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const servers = useServers();
  const templates = useTemplates();
  const createService = useCreateService();
  const appliedPreset = useRef(false);

  const [choice, setChoice] = useState<SourceChoice | null>(null);
  const [name, setName] = useState('');
  const [serverId, setServerId] = useState('');
  const [reference, setReference] = useState('');
  const [branch, setBranch] = useState('main');
  const [domain, setDomain] = useState('');
  const [templateKind, setTemplateKind] = useState<string | undefined>();
  const [asDatabase, setAsDatabase] = useState(true);
  const [publicNetworking, setPublicNetworking] = useState(false);
  const [resources, setResources] = useState<ResourceLimits>({
    cpuCores: 1,
    memoryMb: 1024,
  });

  const option = SOURCE_OPTIONS.find((o) => o.id === choice);
  const isGit = choice === 'git';
  const isImageChoice =
    choice === 'image' || choice === 'database' || choice === 'empty';
  const managedDb = Boolean(templateKind) && asDatabase;
  const github = useGithubStatus();
  const repos = useGithubRepos(isGit && Boolean(github.data?.connected));
  const branches = useGithubBranches(reference);

  const onSelectImage = useCallback(
    (image: RegistryImage | null, tag: string) => {
      if (image) setReference(`${image.name}:${tag}`);
      setTemplateKind(image?.templateKind);
      if (image?.templateKind) setAsDatabase(true);
    },
    [],
  );

  useEffect(() => {
    if (appliedPreset.current) return;
    const presetId = searchParams.get('template');
    if (!presetId || !templates.data) return;
    const tpl = templates.data.find((item) => item.id === presetId);
    if (!tpl) return;
    appliedPreset.current = true;
    setChoice('template');
    setTemplateKind(tpl.kind);
    setAsDatabase(true);
  }, [searchParams, templates.data]);

  const submit = () => {
    if (!option) return;
    if (!name.trim()) return notify.warn('Give your service a name');
    if (!serverId) return notify.warn('Pick a server to deploy on');

    if (managedDb) {
      createService.mutate(
        {
          name: name.trim(),
          kind: 'database',
          serverId,
          resources,
          template: templateKind,
          publicNetworking,
        },
        { onSuccess: () => navigate('/services') },
      );
      return;
    }

    if (isGit) {
      if (!reference.trim()) return notify.warn('Enter a repository');
      createService.mutate(
        {
          name: name.trim(),
          kind: 'git',
          serverId,
          source: { kind: 'git', repo: reference, branch, build: { builder: 'auto' } },
          resources,
          domain: domain.trim() || undefined,
        },
        { onSuccess: () => navigate('/services') },
      );
      return;
    }

    if (choice === 'template') return notify.warn('Pick a template');
    if (!reference.trim()) return notify.warn('Search for or enter an image');
    const [image, tag = 'latest'] = reference.split(':');
    createService.mutate(
      {
        name: name.trim(),
        kind: option.kind,
        serverId,
        source: { kind: 'image', image, tag },
        resources,
        domain: domain.trim() || undefined,
        publicNetworking,
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
          description="Pick a source — search Docker Hub, or point at a repo."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setChoice(opt.id);
              setReference('');
              setTemplateKind(opt.id === 'bucket' ? 'minio' : undefined);
              setAsDatabase(true);
            }}
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

            {isImageChoice ? (
              <div className="space-y-2">
                <Label>Image</Label>
                <ImageSearch
                  dbOnly={choice === 'database'}
                  onSelect={onSelectImage}
                />
                <Input
                  placeholder="or a full reference — ghcr.io/org/app:tag"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="font-mono"
                />
              </div>
            ) : null}

            {choice === 'template' ? (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={templateKind ?? ''}
                  onValueChange={(value) => {
                    setTemplateKind(value);
                    setAsDatabase(true);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        templates.isLoading
                          ? 'Loading templates…'
                          : 'Select a template'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates.data ?? []).map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.kind}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isGit ? (
              <>
                {!github.data?.connected ? (
                  <div className="rounded-lg border p-4 text-sm">Connect the GitHub App in Settings to choose public or private repositories.</div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="ref">Repository (owner/repo)</Label>
                  <Select value={reference} onValueChange={(value) => { setReference(value); const repo = repos.data?.find((item) => item.fullName === value); if (repo) setBranch(repo.defaultBranch); }}>
                    <SelectTrigger id="ref" className="w-full"><SelectValue placeholder={repos.isLoading ? 'Loading repositories…' : 'Select a repository'} /></SelectTrigger>
                    <SelectContent>{(repos.data ?? []).map((repo) => <SelectItem key={repo.fullName} value={repo.fullName}>{repo.fullName}{repo.private ? ' · private' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger id="branch" className="w-full"><SelectValue placeholder="Select a branch" /></SelectTrigger>
                    <SelectContent>{(branches.data ?? []).map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {templateKind ? (
              <div className="border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <Database className="text-primary mt-0.5 size-4" />
                    <div>
                      <p className="text-sm font-medium">
                        Provision as a managed {templateKind}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Generate a username, password, and connection URLs.
                      </p>
                    </div>
                  </div>
                  {choice === 'database' ? (
                    <Switch
                      checked={asDatabase}
                      onCheckedChange={setAsDatabase}
                    />
                  ) : null}
                </div>
                {managedDb ? (
                  <div className="flex items-center justify-between gap-4 border-t border-primary/20 pt-3">
                    <div className="flex items-start gap-2">
                      <Globe className="text-muted-foreground mt-0.5 size-4" />
                      <div>
                        <p className="text-sm font-medium">Expose publicly</p>
                        <p className="text-muted-foreground text-xs">
                          Publish the port on the server's public IP.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={publicNetworking}
                      onCheckedChange={setPublicNetworking}
                    />
                  </div>
                ) : null}
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

            {!managedDb && !isGit ? (
              <div className="space-y-2">
                <Label htmlFor="domain">Domain (optional)</Label>
                <Input
                  id="domain"
                  placeholder="app.example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
            ) : null}

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
