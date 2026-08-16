import { Laptop } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '@/hooks/useSessions';
import { Format } from '@/lib/format';

export function SessionsSettings() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const hasOtherSessions = (sessions.data?.length ?? 0) > 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Active sessions</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasOtherSessions || revokeOthers.isPending}
          onClick={() => revokeOthers.mutate()}
        >
          Sign out other sessions
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Devices and browsers currently signed in to your account.
        </p>
        {sessions.data && sessions.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Laptop className="text-muted-foreground size-4" aria-hidden="true" />
                      <span className="max-w-xs truncate text-sm">
                        {s.userAgent || 'Unknown device'}
                      </span>
                      {s.current ? (
                        <Badge variant="success">This device</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.ip || 'â€”'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {Format.relativeTime(s.lastSeenAt)}
                  </TableCell>
                  <TableCell>
                    {!s.current ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(s.id)}
                      >
                        Sign out
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">No active sessions.</p>
        )}
      </CardContent>
    </Card>
  );
}
