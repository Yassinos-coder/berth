import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Gauge, Github, Globe2, Moon, Sun } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useThemeStore } from '@/store/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { githubService } from '@/services/githubService';
import { useGithubStatus } from '@/hooks/useGithubQueries';
import {
  useResourceSettings,
  usePanelDomain,
  useUpdatePanelDomain,
  useUpdateResourceSettings,
  useVersion,
} from '@/hooks/useSystemQueries';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [org, setOrg] = useState('My Organization');
  const github = useGithubStatus();
  const version = useVersion();
  const resourceSettings = useResourceSettings();
  const updateResourceSettings = useUpdateResourceSettings();
  const panelDomain = usePanelDomain();
  const updatePanelDomain = useUpdatePanelDomain();
  const [domain, setDomain] = useState('');
  const canManageResources = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    if (panelDomain.data) setDomain(panelDomain.data.domain);
  }, [panelDomain.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('github');
    if (!result) return;
    if (result === 'created') {
      notify.success('GitHub App created — now install it on your repositories');
    } else if (result === 'connected') {
      notify.success('GitHub connected');
    }
    queryClient.invalidateQueries({ queryKey: ['github'] });
    params.delete('github');
    const query = params.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (query ? `?${query}` : ''),
    );
  }, [queryClient]);

  const createApp = async () => {
    try {
      const { url, manifest } = await githubService.manifest();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'manifest';
      input.value = JSON.stringify(manifest);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      notify.error('Could not start GitHub App creation', {
        description: (e as Error).message,
      });
    }
  };

  const installApp = async () => {
    try {
      const { url } = await githubService.install();
      window.location.href = url;
    } catch (e) {
      notify.error('Could not start GitHub connection', {
        description: (e as Error).message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organization, integrations, and preferences."
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="networking">Networking</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org">Organization name</Label>
                <Input
                  id="org"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <Button size="sm" onClick={() => notify.success('Settings saved')}>
                Save changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">About Berth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  Running version
                </span>
                <Badge variant="secondary">
                  v{version.data?.version ?? '—'}
                </Badge>
                {version.data?.commit ? (
                  <code className="text-muted-foreground text-xs">
                    {version.data.commit}
                  </code>
                ) : null}
              </div>
              {version.data?.updateAvailable ? (
                <p className="text-warning text-sm">
                  An update is available — run{' '}
                  <code className="font-mono">sudo berth-update</code> on the
                  server.
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  You are on the latest <span className="font-mono">production</span> build.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">GitHub</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-foreground text-background flex size-10 items-center justify-center rounded-lg">
                  <Github className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">GitHub App</p>
                  <p className="text-muted-foreground text-sm">
                    {github.data?.connected
                      ? `Connected as ${github.data.accountLogin}`
                      : github.data?.configured
                        ? 'App ready — install it on your repositories.'
                        : 'Create a GitHub App in one click to deploy from your repositories.'}
                  </p>
                </div>
              </div>
              {github.data?.connected ? (
                <Button variant="outline" onClick={installApp}>
                  Manage
                </Button>
              ) : github.data?.configured ? (
                <Button onClick={installApp}>Install</Button>
              ) : (
                <Button onClick={createApp}>Create GitHub App</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={cn(
                    'hover:border-primary/50 flex w-40 flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
                    theme === t && 'border-primary ring-primary/30 ring-2',
                  )}
                >
                  {t === 'light' ? (
                    <Sun className="size-5" />
                  ) : (
                    <Moon className="size-5" />
                  )}
                  <span className="text-sm font-medium capitalize">{t}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-4" />
                Smart resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <Label htmlFor="smart-resources">Automatic memory scaling</Label>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Watch running services and add 100 MB when memory stays above
                    90% of its limit. Scaling waits for sustained pressure, uses
                    a five-minute cooldown, and preserves 256 MB for the host.
                  </p>
                </div>
                <Switch
                  id="smart-resources"
                  checked={resourceSettings.data?.enabled ?? false}
                  disabled={
                    resourceSettings.isLoading
                    || updateResourceSettings.isPending
                    || !canManageResources
                  }
                  onCheckedChange={(enabled) =>
                    updateResourceSettings.mutate(enabled)
                  }
                  aria-label="Enable smart resources"
                />
              </div>
              {!canManageResources ? (
                <p className="text-xs text-muted-foreground">
                  Only organization owners and admins can change this setting.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="networking" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe2 className="size-4" />
                Panel domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="panel-domain">Domain</Label>
                <Input
                  id="panel-domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="berth.example.com"
                  className="max-w-md font-mono"
                  disabled={!canManageResources || panelDomain.isLoading}
                />
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Point this domain&rsquo;s A record to the panel server. Berth
                  will route both the frontend and <code>/api</code> backend,
                  request a TLS certificate, and redirect HTTP to HTTPS.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!canManageResources || updatePanelDomain.isPending}
                  onClick={() => updatePanelDomain.mutate(domain)}
                >
                  {updatePanelDomain.isPending ? 'Saving…' : 'Save domain'}
                </Button>
                {panelDomain.data?.domain ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canManageResources || updatePanelDomain.isPending}
                    onClick={() => {
                      setDomain('');
                      updatePanelDomain.mutate('');
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              {!canManageResources ? (
                <p className="text-xs text-muted-foreground">
                  Only organization owners and admins can change this setting.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input defaultValue={user?.name ?? ''} className="max-w-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    defaultValue={user?.email ?? ''}
                    className="max-w-sm"
                    readOnly
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Your role:</span>
                <Badge>{user?.role ?? 'owner'}</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
