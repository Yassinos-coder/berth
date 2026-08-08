import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LogLine } from '@/interfaces';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
  debug: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
};

// Docker can return either real escape bytes or U+FFFD when an upstream
// decoder has already replaced ESC. Remove both forms of ANSI SGR sequences.
const ANSI_SGR = /(?:\u001b|\ufffd)\[[0-9;]*m/g;

function clean(message: string) {
  return message.replace(ANSI_SGR, '').replace(/\r/g, '');
}

function levelOf(line: LogLine, message: string): LogLevel {
  if (
    line.stream === 'stderr'
    || /\b(?:error|fatal|exception|failed)\b/i.test(message)
  ) return 'error';
  if (/\bwarn(?:ing)?\b/i.test(message)) return 'warn';
  if (/\b(?:debug|verbose|trace)\b/i.test(message)) return 'debug';
  return 'info';
}

function ts(n: number) {
  return new Date(n).toLocaleTimeString(undefined, { hour12: false });
}

export function LogViewer({ lines }: { lines: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => lines.map((line) => {
      const message = clean(line.line);
      return { ...line, message, level: levelOf(line, message) };
    }),
    [lines],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  return (
    <div className="h-[460px] overflow-auto rounded-lg border border-white/10 bg-[oklch(0.115_0.012_250)] font-mono text-[13px] leading-5 shadow-inner">
      {lines.length === 0 ? (
        <p className="p-4 text-muted-foreground">Waiting for log output&hellip;</p>
      ) : (
        rows.map((line) => (
          <div
            key={line.id}
            className="group grid min-w-max grid-cols-[5.5rem_3.5rem_1fr] items-start gap-3 border-b border-white/[0.035] px-4 py-1.5 hover:bg-white/[0.035]"
          >
            <span className="select-none tabular-nums text-slate-500">
              {ts(line.ts)}
            </span>
            <span
              className={cn(
                'w-fit select-none rounded border px-1.5 text-[10px] font-semibold uppercase leading-[18px] tracking-wider',
                LEVEL_STYLE[line.level],
              )}
            >
              {line.level}
            </span>
            <code className="whitespace-pre-wrap break-words pr-4 text-slate-200 [overflow-wrap:anywhere]">
              {line.message}
            </code>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
