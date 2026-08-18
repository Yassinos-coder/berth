import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowDown, Download, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogLine } from '@/interfaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
const CARRIAGE_RETURN = /\r/g;
const ERROR_PATTERN = /\b(?:error|fatal|exception|failed)\b/i;
const WARN_PATTERN = /\bwarn(?:ing)?\b/i;
const DEBUG_PATTERN = /\b(?:debug|verbose|trace)\b/i;

// How close to the bottom (px) the user has to be for new lines to keep
// auto-scrolling. Scrolling up past this disables "follow" until they return.
const FOLLOW_THRESHOLD_PX = 48;

function clean(message: string) {
  return message.replace(ANSI_SGR, '').replace(CARRIAGE_RETURN, '');
}

function levelOf(line: LogLine, message: string): LogLevel {
  if (line.stream === 'stderr' || ERROR_PATTERN.test(message)) return 'error';
  if (WARN_PATTERN.test(message)) return 'warn';
  if (DEBUG_PATTERN.test(message)) return 'debug';
  return 'info';
}

function ts(n: number) {
  return new Date(n).toLocaleTimeString(undefined, { hour12: false });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function downloadLog(
  lines: { ts: number; level: LogLevel; message: string }[],
  serviceName: string,
) {
  const body = lines
    .map(
      (line) =>
        `${new Date(line.ts).toISOString()} [${line.level}] ${line.message}`,
    )
    .join('\n');
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${serviceName || 'service'}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LogViewer({
  lines,
  serviceName = 'service',
}: {
  lines: LogLine[];
  serviceName?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [wrap, setWrap] = useState(true);
  const [following, setFollowing] = useState(true);

  const deferredQuery = useDeferredValue(query);
  const deferredLevel = useDeferredValue(level);

  const rows = useMemo(
    () =>
      lines.map((line) => {
        const message = clean(line.line);
        return { ...line, message, level: levelOf(line, message) };
      }),
    [lines],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle && deferredLevel === 'all') return rows;
    return rows.filter((row) => {
      if (deferredLevel !== 'all' && row.level !== deferredLevel) return false;
      if (needle && !row.message.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, deferredLevel, deferredQuery]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
    setFollowing(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    setFollowing(true);
  }, []);

  useEffect(() => {
    if (!following) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [filtered, following]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="log-filter" className="sr-only">
          Filter log output
        </Label>
        <Input
          id="log-filter"
          type="search"
          name="log-filter"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter logs…"
          className="h-8 w-56"
        />
        <Label htmlFor="log-level" className="sr-only">
          Filter by log level
        </Label>
        <Select
          value={level}
          onValueChange={(value) => setLevel(value as LogLevel | 'all')}
        >
          <SelectTrigger id="log-level" size="sm" className="w-32">
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
        <span
          className="text-muted-foreground text-xs tabular-nums"
          aria-live="polite"
        >
          {filtered.length === rows.length
            ? `${rows.length} lines`
            : `${filtered.length} / ${rows.length} lines`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!following && (
            <Button variant="secondary" size="sm" onClick={scrollToBottom}>
              <ArrowDown className="size-3.5" aria-hidden="true" />
              Jump to Latest
            </Button>
          )}
          <Button
            variant={wrap ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setWrap((prev) => !prev)}
            aria-pressed={wrap}
            aria-label={wrap ? 'Disable line wrap' : 'Enable line wrap'}
          >
            <WrapText className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadLog(filtered, serviceName)}
            disabled={filtered.length === 0}
            aria-label="Download visible logs"
          >
            <Download className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Container log output"
        tabIndex={0}
        className="focus-visible:ring-ring/40 h-[460px] overflow-auto overscroll-contain rounded-lg border border-white/10 bg-[oklch(0.115_0.012_250)] font-mono text-[13px] leading-5 shadow-inner outline-none focus-visible:ring-[3px]"
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-4">Waiting for log output…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground p-4">
            No log lines match your filter. Clear the search box or choose “All
            levels”.
          </p>
        ) : (
          filtered.map((line) => (
            <div
              key={line.id}
              className={cn(
                'group grid min-w-max grid-cols-[5.5rem_3.5rem_1fr] items-start gap-3 border-b border-white/[0.035] px-4 py-1.5 [content-visibility:auto] [contain-intrinsic-size:auto_28px] hover:bg-white/[0.035]',
                !wrap && 'w-max',
              )}
            >
              <span className="tabular-nums text-slate-500 select-none">
                {ts(line.ts)}
              </span>
              <span
                className={cn(
                  'w-fit rounded border px-1.5 text-[10px] leading-[18px] font-semibold tracking-wider uppercase select-none',
                  LEVEL_STYLE[line.level],
                )}
              >
                {line.level}
              </span>
              <code
                className={cn(
                  'pr-4 text-slate-200',
                  wrap ? 'wrap-anywhere whitespace-pre-wrap' : 'whitespace-pre',
                )}
                translate="no"
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
