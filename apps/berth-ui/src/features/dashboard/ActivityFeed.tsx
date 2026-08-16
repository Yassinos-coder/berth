import { GitCommitHorizontal, Loader2, Server, Trash2, UserPlus, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useClearActivity } from '@/hooks/useDashboardQueries';
import { Format } from '@/lib/format';
import type { ActivityItem } from '@/interfaces';

const ICONS = {
  deploy: GitCommitHorizontal,
  server: Server,
  member: UserPlus,
  system: Bell,
} as const;

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const clearActivity = useClearActivity();

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <CardTitle className="text-base">Recent activity</CardTitle>
        {items.length > 0 ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground -mr-2">
                <Trash2 className="size-3.5" aria-hidden="true" /> Clear
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear activity?</DialogTitle>
                <DialogDescription>
                  This permanently deletes the organization's activity history. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    disabled={clearActivity.isPending}
                    onClick={() => clearActivity.mutate()}
                  >
                    {clearActivity.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Clear
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="text-muted-foreground px-6 py-10 text-center text-sm">
            No activity yet.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.id} className="flex gap-3 px-6 py-3.5">
                  <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {Format.relativeTime(item.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
