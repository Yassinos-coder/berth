import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ResourceLimits } from '@/interfaces';

const CPU_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];
const MEM_OPTIONS = [256, 512, 1024, 2048, 4096, 8192, 16384];

export const PRESETS: { id: string; name: string; hint: string; value: ResourceLimits }[] = [
  { id: 'small', name: 'Small', hint: '0.5 vCPU · 512 MB', value: { cpuCores: 0.5, memoryMb: 512 } },
  { id: 'medium', name: 'Medium', hint: '1 vCPU · 1 GB', value: { cpuCores: 1, memoryMb: 1024 } },
  { id: 'large', name: 'Large', hint: '2 vCPU · 4 GB', value: { cpuCores: 2, memoryMb: 4096 } },
];

export class ResourcePresetMatch {
  static idFor(value: ResourceLimits): string {
    const match = PRESETS.find(
      (preset) => preset.value.cpuCores === value.cpuCores && preset.value.memoryMb === value.memoryMb,
    );
    return match?.id ?? 'custom';
  }
}

export function ResourcePresets({
  value,
  onChange,
}: {
  value: ResourceLimits;
  onChange: (next: ResourceLimits) => void;
}) {
  const selected = ResourcePresetMatch.idFor(value);
  const custom = selected === 'custom';

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Resource size" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected === preset.id}
            onClick={() => onChange(preset.value)}
            className={cn(
              'focus-visible:ring-ring/40 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-[3px]',
              selected === preset.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
            )}
          >
            <span className="block text-sm font-medium">{preset.name}</span>
            <span className="text-muted-foreground block text-xs">{preset.hint}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => onChange({ cpuCores: 1.5, memoryMb: 3072 })}
          className={cn(
            'focus-visible:ring-ring/40 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-[3px]',
            custom ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
          )}
        >
          <span className="block text-sm font-medium">Custom</span>
          <span className="text-muted-foreground block text-xs">Pick your own</span>
        </button>
      </div>

      {custom ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">CPU limit</Label>
            <Select value={String(value.cpuCores)} onValueChange={(v) => onChange({ ...value, cpuCores: Number(v) })}>
              <SelectTrigger className="w-full" aria-label="CPU limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...CPU_OPTIONS, value.cpuCores])].sort((a, b) => a - b).map((cores) => (
                  <SelectItem key={cores} value={String(cores)}>
                    {cores < 1 ? `${cores * 1000}m` : `${cores} vCPU`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Memory limit</Label>
            <Select value={String(value.memoryMb)} onValueChange={(v) => onChange({ ...value, memoryMb: Number(v) })}>
              <SelectTrigger className="w-full" aria-label="Memory limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...MEM_OPTIONS, value.memoryMb])].sort((a, b) => a - b).map((mb) => (
                  <SelectItem key={mb} value={String(mb)}>
                    {mb < 1024 ? `${mb} MB` : `${mb / 1024} GB`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
