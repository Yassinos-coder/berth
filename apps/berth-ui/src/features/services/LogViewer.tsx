import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Download, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogLine } from '@/interfaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
  debug: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
};

const LEVEL_OPTIONS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All levels' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

// Docker can return either real escape bytes or U+FFFD when an upstream
// decoder has already replaced ESC. Remove both forms of ANSI SGR sequences.
const ANSI_SGR = /(?:\u001b|\ufffd)\[[0-9;]*m/g;

// How close to the bottom (px) the user has to be for new lines to keep
// auto-scrolling. Scrolling up past this disables "follow" until they return.
const FOLLOW_THRESHOLD_PX = 48;

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

function downloadLog(lines: { ts: number; level: LogLevel; message: string }[], serviceName: string) {
  const body = lines
    .map((line) => `${new Date(line.ts).toISOString()} [${line.level}] ${line.message}`)
    .join('\n');
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${serviceName || 'service'}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LogViewer({ lines, serviceName = 'service' }: { lines: LogLine[]; serviceName?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [wrap, setWrap] = useState(true);
  const [following, setFollowing] = useState(true);

  const rows = useMemo(
    () => lines.map((line) => {
      const message = clean(line.line);
      return { ...line, message, level: levelOf(line, message) };
    }),
    [lines],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (level !== 'all' && row.level !== level) return false;
      if (needle && !row.message.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, level, query]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
    setFollowing(atBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setFollowing(true);
  }, []);

  useEffect(() => {
    if (!following) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [filtered, following]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter logs…"
          className="h-8 w-56"
        />
        <Select value={level} onValueChange={(value) => setLevel(value as LogLevel | 'all')}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length === rows.length
            ? `${rows.length} lines`
            : `${filtered.length} / ${rows.length} lines`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!following && (
            <Button variant="secondary" size="sm" onClick={() => scrollToBottom()}>
              <ArrowDown className="size-3.5" />
              Jump to latest
            </Button>
          )}
          <Button
            variant={wrap ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setWrap((prev) => !prev)}
            title={wrap ? 'Disable line wrap' : 'Enable line wrap'}
          >
            <WrapText className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadLog(filtered, serviceName)}
            disabled={filtered.length === 0}
            title="Download visible logs"
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-[460px] overflow-auto rounded-lg border border-white/10 bg-[oklch(0.115_0.012_250)] font-mono text-[13px] leading-5 shadow-inner"
      >
        {rows.length === 0 ? (
          <p className="p-4 text-muted-foreground">Waiting for log output&hellip;</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-muted-foreground">No log lines match your filter.</p>
        ) : (
          filtered.map((line) => (
            <div
              key={line.id}
              className={cn(
                'group grid min-w-max grid-cols-[5.5rem_3.5rem_1fr] items-start gap-3 border-b border-white/[0.035] px-4 py-1.5 hover:bg-white/[0.035]',
                !wrap && 'w-max',
              )}
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
              <code
                className={cn(
                  'pr-4 text-slate-200',
                  wrap ? 'whitespace-pre-wrap wrap-anywhere' : 'whitespace-pre',
                )}
              >
                {line.message}
              </code>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
