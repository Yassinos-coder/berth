import { useState } from 'react';
import { Github, Moon, Sun } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useThemeStore } from '@/store/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { notify } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const { user } = useAuth();
  const [org, setOrg] = useState('My Organization');

  const connectGithub = async () => {
    try {
      const { url } = await authService.connectGithub();
      if (url && url !== '#') window.location.href = url;
      else notify.info('Connect GitHub once berth-server is running');
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
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
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
                    Connect repositories and receive push webhooks.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={connectGithub}>
                Connect
              </Button>
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
