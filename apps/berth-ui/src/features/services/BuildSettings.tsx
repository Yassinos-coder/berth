import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';
import { useGithubTree } from '@/hooks/useGithubQueries';
import type { BuildConfig } from '@berth/protocol';

type Builder = 'auto' | 'nixpacks' | 'dockerfile';

function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

function PickerField({
  label,
  hint,
  placeholder,
  value,
  options,
  rootOption,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  options: string[];
  rootOption: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || '__root__'} onValueChange={(v) => onChange(v === '__root__' ? '' : v)}>
        <SelectTrigger className="w-full font-mono text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__root__">{rootOption}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

export function BuildSettings({
  serviceId,
  build,
  repo,
  branch,
}: {
  serviceId: string;
  build: BuildConfig;
  repo: string;
  branch: string;
}) {
  const [builder, setBuilder] = useState<Builder>(build.builder ?? 'auto');
  const [rootDirectory, setRootDirectory] = useState(build.rootDirectory ?? '');
  const [dockerfilePath, setDockerfilePath] = useState(
    build.dockerfilePath ?? '',
  );
  const [buildCommand, setBuildCommand] = useState(build.buildCommand ?? '');
  const [startCommand, setStartCommand] = useState(build.startCommand ?? '');
  const update = useUpdateServiceSettings(serviceId);
  const tree = useGithubTree(repo, branch);

  const showDockerfile = builder !== 'nixpacks';
  const showNixpacks = builder !== 'dockerfile';
  const dockerfileOptions = (tree.data?.dockerfiles ?? []).filter(
    (path) => !rootDirectory || path.startsWith(`${rootDirectory}/`) || path === rootDirectory,
  );

  const save = () =>
    update.mutate({
      builder,
      rootDirectory,
      dockerfilePath,
      buildCommand,
      startCommand,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Build &amp; deploy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Builder</Label>
          <Select value={builder} onValueChange={(v) => setBuilder(v as Builder)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Dockerfile if present, else Nixpacks)</SelectItem>
              <SelectItem value="dockerfile">Dockerfile</SelectItem>
              <SelectItem value="nixpacks">Nixpacks</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Use Dockerfile when your repo ships one; Nixpacks auto-builds
            otherwise.
          </p>
        </div>

        {tree.data ? (
          <PickerField
            label="Root directory"
            hint="Build context. Leave blank for the repo root — a monorepo Dockerfile that copies workspace packages must build from the root."
            placeholder="(repo root)"
            value={rootDirectory}
            options={tree.data.directories}
            rootOption="(repo root)"
            onChange={(value) => {
              setRootDirectory(value);
              setDockerfilePath('');
            }}
          />
        ) : (
          <Field
            label="Root directory"
            hint="Build context. Leave blank for the repo root — a monorepo Dockerfile that copies workspace packages must build from the root."
            placeholder="(repo root)"
            value={rootDirectory}
            onChange={setRootDirectory}
          />
        )}

        {showDockerfile ? (
          tree.data ? (
            <PickerField
              label="Dockerfile path"
              hint="Path to the Dockerfile, relative to the root directory above."
              placeholder="Dockerfile"
              value={dockerfilePath}
              options={dockerfileOptions.map((path) =>
                rootDirectory && path.startsWith(`${rootDirectory}/`)
                  ? path.slice(rootDirectory.length + 1)
                  : path,
              )}
              rootOption="Dockerfile"
              onChange={setDockerfilePath}
            />
          ) : (
            <Field
              label="Dockerfile path"
              hint="Path to the Dockerfile, relative to the root directory above."
              placeholder="apps/server/Dockerfile"
              value={dockerfilePath}
              onChange={setDockerfilePath}
            />
          )
        ) : null}

        {showNixpacks ? (
          <>
            <Field
              label="Build command"
              hint="Nixpacks only. Overrides the auto-detected build step; leave blank to auto-detect."
              placeholder="npx turbo run build --filter=@app/service"
              value={buildCommand}
              onChange={setBuildCommand}
            />
            <Field
              label="Start command"
              hint="Nixpacks only. Command that starts your app inside the container."
              placeholder="node apps/service/dist/main.js"
              value={startCommand}
              onChange={setStartCommand}
            />
          </>
        ) : null}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Save build settings
          </Button>
          <span className="text-muted-foreground text-xs">
            Redeploy to apply.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
