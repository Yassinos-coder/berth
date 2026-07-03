import { GitCommitHorizontal, Server, UserPlus, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Format } from '@/lib/format';
import type { ActivityItem } from '@/interfaces';

const ICONS = {
  deploy: GitCommitHorizontal,
  server: Server,
  member: UserPlus,
  system: Bell,
} as const;

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-base">Recent activity</CardTitle>
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
                    <Icon className="size-4" />
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
