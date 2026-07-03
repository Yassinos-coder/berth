import { Cpu, MemoryStick } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ResourceLimits } from '@/interfaces';

const CPU_OPTIONS = [0.25, 0.5, 1, 2, 4];
const MEM_OPTIONS = [256, 512, 1024, 2048, 4096, 8192];

export function ResourceLimitsField({
  value,
  onChange,
}: {
  value: ResourceLimits;
  onChange: (next: ResourceLimits) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-muted-foreground">
          <Cpu className="size-4" /> CPU limit
        </Label>
        <Select
          value={String(value.cpuCores)}
          onValueChange={(v) => onChange({ ...value, cpuCores: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CPU_OPTIONS.map((c) => (
              <SelectItem key={c} value={String(c)}>
                {c < 1 ? `${c * 1000}m` : `${c} vCPU`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">
          <MemoryStick className="size-4" /> Memory limit
        </Label>
        <Select
          value={String(value.memoryMb)}
          onValueChange={(v) => onChange({ ...value, memoryMb: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEM_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m < 1024 ? `${m} MB` : `${m / 1024} GB`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
