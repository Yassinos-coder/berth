import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceMoveRules } from '@/features/services/serviceMoveRules';
import { useMoveService } from '@/hooks/useServicesMutations';
import type { Server, Service } from '@/interfaces';

export function MoveServiceCard({
  service,
  servers,
  hasDomains,
}: {
  service: Service;
  servers: Server[];
  hasDomains: boolean;
}) {
  const move = useMoveService(service.id);
  const [targetId, setTargetId] = useState('');
  const [acceptsDataLoss, setAcceptsDataLoss] = useState(false);
  const targets = ServiceMoveRules.targets(servers, service.serverId);
  const hasFiles = Boolean(service.volumePath);
  const target = targets.find((item) => item.id === targetId);
  const blocked = !target || (hasFiles && !acceptsDataLoss) || Boolean(service.previewOfId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="size-4" aria-hidden="true" />
          Move to another server
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {service.previewOfId ? (
          <p className="text-muted-foreground text-sm">Preview environments cannot be moved.</p>
        ) : targets.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            There is no other online server. Add one under Servers to move this service.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Currently on <span className="font-medium">{service.serverName}</span>. Use this when a server is being
              retired or is too full.
            </p>
            <div className="space-y-2">
              <Label htmlFor="move-target">New server</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id="move-target" className="w-64">
                  <SelectValue placeholder="Choose a server" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.cpuCores} vCPU, {Math.round(item.memoryMb / 1024)} GB)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFiles ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptsDataLoss}
                  onChange={(event) => setAcceptsDataLoss(event.target.checked)}
                  className="mt-1"
                />
                <span>I understand this service&apos;s stored files will not move with it.</span>
              </label>
            ) : null}
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" disabled={blocked || move.isPending}>
                  Move service
                </Button>
              }
              title={`Move ${service.name} to ${target?.name ?? 'the new server'}?`}
              description={
                <span className="block space-y-1 text-left">
                  {ServiceMoveRules.warnings(hasFiles, hasDomains).map((note) => (
                    <span key={note} className="block">
                      • {note}
                    </span>
                  ))}
                </span>
              }
              confirmLabel="Move service"
              isPending={move.isPending}
              onConfirm={() => move.mutate({ serverId: targetId, confirmDataLoss: acceptsDataLoss })}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
