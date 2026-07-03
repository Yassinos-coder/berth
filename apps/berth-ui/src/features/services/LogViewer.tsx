import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LogLine, LogStream } from '@/interfaces';

const STREAM_COLOR: Record<LogStream, string> = {
  stdout: 'text-foreground',
  stderr: 'text-destructive',
  build: 'text-primary',
  system: 'text-muted-foreground',
};

function ts(n: number) {
  return new Date(n).toLocaleTimeString(undefined, { hour12: false });
}

export function LogViewer({ lines }: { lines: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  return (
    <div className="bg-[oklch(0.14_0.01_250)] h-[460px] overflow-auto rounded-lg border p-4 font-mono text-xs leading-relaxed">
      {lines.length === 0 ? (
        <p className="text-muted-foreground">Waiting for log output…</p>
      ) : (
        lines.map((line) => (
          <div key={line.id} className="flex gap-3 whitespace-pre-wrap">
            <span className="text-muted-foreground/70 shrink-0 select-none">
              {ts(line.ts)}
            </span>
            <span className={cn('shrink-0 select-none uppercase opacity-70', STREAM_COLOR[line.stream])}>
              {line.stream.slice(0, 3)}
            </span>
            <span className={cn('break-all', STREAM_COLOR[line.stream])}>
              {line.line}
            </span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
