import { HardDrive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { StorageGuidance } from '@/features/services/new/storageGuidance';

export function StorageSection({
  guidance,
  enabled,
  onEnabledChange,
  sizeGb,
  onSizeGbChange,
  mountPath,
  onMountPathChange,
}: {
  guidance: StorageGuidance;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  sizeGb: number;
  onSizeGbChange: (next: number) => void;
  mountPath: string;
  onMountPathChange: (next: string) => void;
}) {
  const optional = guidance.mode === 'optional';
  const sizeError = sizeGb < 1 || sizeGb > 2048 || !Number.isInteger(sizeGb) ? 'Use a whole number from 1 to 2048 GB.' : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <HardDrive className="text-muted-foreground size-4" aria-hidden="true" />
            {guidance.title}
          </p>
          <p className="text-muted-foreground text-xs">{guidance.body}</p>
        </div>
        {optional ? (
          <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="This service needs persistent storage" />
        ) : null}
      </div>

      {enabled ? (
        <div className="space-y-3 rounded-lg border p-3">
          {optional ? (
            <div className="space-y-1.5">
              <Label htmlFor="storage-mount">Mount path inside the container</Label>
              <Input
                id="storage-mount"
                placeholder="/app/data"
                value={mountPath}
                onChange={(event) => onMountPathChange(event.target.value)}
                className="font-mono"
                autoComplete="off"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="storage-size">Size (GB)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {guidance.presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSizeGbChange(preset)}
                  aria-pressed={sizeGb === preset}
                  className={cn(
                    'focus-visible:ring-ring/40 rounded-md border px-2.5 py-1 font-mono text-xs outline-none focus-visible:ring-[3px]',
                    sizeGb === preset ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
                  )}
                >
                  {preset} GB
                </button>
              ))}
              <Input
                id="storage-size"
                type="number"
                min={1}
                max={2048}
                value={Number.isFinite(sizeGb) ? sizeGb : ''}
                onChange={(event) => onSizeGbChange(Number(event.target.value))}
                aria-invalid={Boolean(sizeError)}
                className="w-24 font-mono"
              />
            </div>
            {sizeError ? (
              <p className="text-destructive text-xs">{sizeError}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                A hard limit: the service cannot write past it. You can change it later.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
