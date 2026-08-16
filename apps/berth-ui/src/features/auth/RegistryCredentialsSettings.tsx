import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useCreateRegistryCredential,
  useRegistryCredentials,
  useRemoveRegistryCredential,
} from '@/hooks/useRegistryCredentials';

function AddCredentialDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const create = useCreateRegistryCredential();

  const reset = () => {
    setName('');
    setServer('');
    setUsername('');
    setPassword('');
  };

  const submit = () => {
    if (!name.trim() || !username.trim() || !password) return;
    create.mutate(
      { name: name.trim(), server: server.trim(), username, password },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" /> Add credential
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add registry credential</DialogTitle>
          <DialogDescription>
            The agent uses this to authenticate before pulling or building
            private images. Leave the server blank for Docker Hub.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cred-name">Name</Label>
            <Input
              id="cred-name"
              placeholder="GitHub Container Registry"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-server">Server</Label>
            <Input
              id="cred-server"
              placeholder="ghcr.io"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-username">Username</Label>
            <Input
              id="cred-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-password">Password or access token</Label>
            <Input
              id="cred-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={
              create.isPending || !name.trim() || !username.trim() || !password
            }
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RegistryCredentialsSettings() {
  const credentials = useRegistryCredentials();
  const remove = useRemoveRegistryCredential();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Private registries</CardTitle>
        <AddCredentialDialog />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Credentials for pulling private images from Docker Hub, GHCR, ECR,
          or any self-hosted registry. Attach one to a service from its
          Settings tab.
        </p>
        {credentials.data && credentials.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Username</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.server || 'docker.io'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.username}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 className="text-destructive size-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            No registry credentials yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
