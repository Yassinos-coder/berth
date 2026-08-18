import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  Globe,
  KeyRound,
  Loader2,
  Split,
} from 'lucide-react';
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
import {
  useGithubBranches,
  useGithubRepos,
  useGithubStatus,
  useGithubTree,
} from '@/hooks/useGithubQueries';
import { useTemplates } from '@/hooks/useTemplatesQueries';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { detectMonorepoApps } from '@/features/services/repoTree';
import { MonorepoSplitDialog } from '@/features/services/MonorepoSplitDialog';
import type { RegistryImage, ResourceLimits } from '@/interfaces';

function relativeToRoot(path: string, root: string): string {
  if (!root) return path;
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

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
  const [customCredentials, setCustomCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [publicNetworking, setPublicNetworking] = useState(false);
  const [resources, setResources] = useState<ResourceLimits>({
    cpuCores: 1,
    memoryMb: 1024,
  });
  const [diskGb, setDiskGb] = useState(5);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rootDirectory, setRootDirectory] = useState('');
  const [dockerfilePath, setDockerfilePath] = useState('');
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const promptedForRef = useRef('');

  const option = SOURCE_OPTIONS.find((o) => o.id === choice);
  const isGit = choice === 'git';
  const isImageChoice =
    choice === 'image' || choice === 'database' || choice === 'empty';
  const selectedServer = servers.data?.find((s) => s.id === serverId);
  const diskHint = selectedServer
    ? `${Math.max(0, Math.round(selectedServer.usage.diskTotalGb - selectedServer.usage.diskGb))} GB free of ${selectedServer.usage.diskTotalGb} GB on ${selectedServer.name}.`
    : undefined;
  const managedDb = Boolean(templateKind) && asDatabase;
  const github = useGithubStatus();
  const repos = useGithubRepos(isGit && Boolean(github.data?.connected));
  const branches = useGithubBranches(reference);
  const tree = useGithubTree(isGit ? reference : '', branch);
  const detectedApps = useMemo(
    () => (tree.data ? detectMonorepoApps(tree.data, reference.split('/').pop() ?? '') : []),
    [tree.data, reference],
  );
  const directoryOptions = tree.data?.directories ?? [];
  const dockerfileOptions = (tree.data?.dockerfiles ?? []).filter(
    (path) => !rootDirectory || path.startsWith(`${rootDirectory}/`) || path === rootDirectory,
  );

  useEffect(() => {
    if (!isGit || !reference) return;
    if (detectedApps.length < 2) return;
    if (promptedForRef.current === reference) return;
    promptedForRef.current = reference;
    setSplitDialogOpen(true);
  }, [isGit, reference, detectedApps.length]);

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
      if (customCredentials && password.trim() && password.trim().length < 8) {
        return notify.warn('Password must be at least 8 characters');
      }
      createService.mutate(
        {
          name: name.trim(),
          kind: 'database',
          serverId,
          resources,
          template: templateKind,
          publicNetworking,
          username: customCredentials ? username.trim() || undefined : undefined,
          password: customCredentials ? password.trim() || undefined : undefined,
          diskGb,
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
          source: {
            kind: 'git',
            repo: reference,
            branch,
            build: {
              builder: dockerfilePath ? 'dockerfile' : 'auto',
              rootDirectory: rootDirectory || undefined,
              dockerfilePath: dockerfilePath || undefined,
            },
          },
          resources,
          domain: domain.trim() || undefined,
          diskGb,
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
        diskGb,
      },
      { onSuccess: () => navigate('/services') },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/services">
            <ArrowLeft className="size-4" aria-hidden="true" /> Services
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
              setCustomCredentials(false);
              setUsername('');
              setPassword('');
            }}
            className={cn(
              'group hover:border-primary/50 relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors',
              choice === opt.id && 'border-primary ring-primary/30 ring-2',
            )}
          >
            {choice === opt.id ? (
              <span className="bg-primary text-primary-foreground absolute top-3 right-3 flex size-5 items-center justify-center rounded-full">
                <Check className="size-3" aria-hidden="true" />
              </span>
            ) : null}
            <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
              <opt.icon className="size-4.5" aria-hidden="true" />
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
                  <Select value={reference} onValueChange={(value) => { setReference(value); setRootDirectory(''); setDockerfilePath(''); const repo = repos.data?.find((item) => item.fullName === value); if (repo) setBranch(repo.defaultBranch); }}>
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
                {reference ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="root-dir">Root directory</Label>
                      <Select
                        value={rootDirectory || '__root__'}
                        onValueChange={(value) => {
                          setRootDirectory(value === '__root__' ? '' : value);
                          setDockerfilePath('');
                        }}
                      >
                        <SelectTrigger id="root-dir" className="w-full">
                          <SelectValue placeholder={tree.isLoading ? 'Reading repo…' : '(repo root)'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__root__">(repo root)</SelectItem>
                          {directoryOptions.map((dir) => (
                            <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dockerfile-path">Dockerfile</Label>
                      <Select
                        value={dockerfilePath || '__auto__'}
                        onValueChange={(value) =>
                          setDockerfilePath(value === '__auto__' ? '' : relativeToRoot(value, rootDirectory))
                        }
                      >
                        <SelectTrigger id="dockerfile-path" className="w-full">
                          <SelectValue placeholder="Auto-detect" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__auto__">Auto-detect</SelectItem>
                          {dockerfileOptions.map((path) => (
                            <SelectItem key={path} value={path}>{path}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {templateKind ? (
              <div className="border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <Database className="text-primary mt-0.5 size-4" aria-hidden="true" />
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
                      <Globe className="text-muted-foreground mt-0.5 size-4" aria-hidden="true" />
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
                {managedDb ? (
                  <div className="border-t border-primary/20 pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <KeyRound className="text-muted-foreground mt-0.5 size-4" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">
                            Custom username & password
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Leave off to auto-generate secure credentials.
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={customCredentials}
                        onCheckedChange={(checked) => {
                          setCustomCredentials(checked);
                          if (!checked) {
                            setUsername('');
                            setPassword('');
                          }
                        }}
                      />
                    </div>
                    {customCredentials ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="db-username" className="text-xs">
                            Username
                          </Label>
                          <Input
                            id="db-username"
                            placeholder="berth"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="db-password" className="text-xs">
                            Password
                          </Label>
                          <Input
                            id="db-password"
                            type="text"
                            placeholder="min. 8 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="font-mono"
                          />
                        </div>
                      </div>
                    ) : null}
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

            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm font-medium transition-colors"
              >
                Advanced settings
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform',
                    advancedOpen && 'rotate-180',
                  )}
                />
              </button>
              {advancedOpen ? (
                <div className="space-y-4 pt-4">
                  {isGit && detectedApps.length >= 2 ? (
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {detectedApps.length} Dockerfiles detected in this repo
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Reopen the split prompt if you dismissed it or it
                          didn't show up.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSplitDialogOpen(true)}
                      >
                        <Split className="size-4" aria-hidden="true" />
                        Split into services
                      </Button>
                    </div>
                  ) : null}
                  <ResourceLimitsField
                    value={resources}
                    onChange={setResources}
                    diskGb={diskGb}
                    onDiskGbChange={setDiskGb}
                    diskHint={diskHint}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link to="/services">Cancel</Link>
              </Button>
              <Button onClick={submit} disabled={createService.isPending}>
                {createService.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Create service
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isGit && detectedApps.length >= 2 ? (
        <MonorepoSplitDialog
          open={splitDialogOpen}
          onOpenChange={setSplitDialogOpen}
          repo={reference}
          branch={branch}
          apps={detectedApps}
          servers={servers.data ?? []}
          serverId={serverId}
          onServerIdChange={setServerId}
          resources={resources}
          diskGb={diskGb}
          onUseSingle={() => setSplitDialogOpen(false)}
          onCreated={() => navigate('/services')}
        />
      ) : null}
    </div>
  );
}
