import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';
import type { Service } from '@/interfaces';

const CPU_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];
const MEMORY_OPTIONS = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

export function ResourceSettings({
  serviceId,
  resources,
}: {
  serviceId: string;
  resources: Service['resources'];
}) {
  const [cpuCores, setCpuCores] = useState(resources.cpuCores);
  const [memoryMb, setMemoryMb] = useState(resources.memoryMb);
  const update = useUpdateServiceSettings(serviceId);
  const cpuOptions = [...new Set([...CPU_OPTIONS, resources.cpuCores])].sort(
    (a, b) => a - b,
  );
  const memoryOptions = [...new Set([...MEMORY_OPTIONS, resources.memoryMb])].sort(
    (a, b) => a - b,
  );
  const unchanged =
    cpuCores === resources.cpuCores && memoryMb === resources.memoryMb;

  useEffect(() => {
    setCpuCores(resources.cpuCores);
    setMemoryMb(resources.memoryMb);
  }, [resources.cpuCores, resources.memoryMb]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vertical scaling</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>CPU limit</Label>
            <Select
              value={String(cpuCores)}
              onValueChange={(value) => setCpuCores(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cpuOptions.map((cores) => (
                  <SelectItem key={cores} value={String(cores)}>
                    {cores < 1 ? `${cores * 1000}m` : `${cores} vCPU`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Memory limit</Label>
            <Select
              value={String(memoryMb)}
              onValueChange={(value) => setMemoryMb(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memoryOptions.map((memory) => (
                  <SelectItem key={memory} value={String(memory)}>
                    {memory < 1024 ? `${memory} MB` : `${memory / 1024} GB`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={unchanged || update.isPending}
            onClick={() => update.mutate({ resources: { cpuCores, memoryMb } })}
          >
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Apply limits
          </Button>
          <span className="text-muted-foreground text-xs">
            Applied live to running containers without rebuilding the image.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
