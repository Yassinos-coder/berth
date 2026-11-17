import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Eraser, Loader2, RefreshCw, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  TERMINAL_OPTIONS,
  TERMINAL_THEME,
  TerminalKeys,
} from '@/features/services/terminalTheme';

type Status = 'connecting' | 'connected' | 'closed' | 'error';

const STATUS_DOT: Record<Status, string> = {
  connecting: 'bg-warning animate-pulse',
  connected: 'bg-success',
  closed: 'bg-muted-foreground',
  error: 'bg-destructive',
};

function socketUrl(serviceId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/services/${encodeURIComponent(serviceId)}/exec`;
}

function sendInput(socket: WebSocket | null, data: string) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  socket.send(JSON.stringify({ type: 'input', data: btoa(binary) }));
}

function sendResize(socket: WebSocket | null, cols: number, rows: number) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'resize', cols, rows }));
}

export function ServiceTerminal({ serviceId }: { serviceId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [exitCode, setExitCode] = useState<number | null | undefined>(undefined);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const term = new Terminal(TERMINAL_OPTIONS);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    if (containerRef.current) term.open(containerRef.current);
    fitAddon.fit();
    void document.fonts?.ready.then(() => {
      if (termRef.current !== term) return;
      term.options.fontFamily = TERMINAL_OPTIONS.fontFamily;
      fitAddon.fit();
    });

    term.attachCustomKeyEventHandler((event) => {
      if (TerminalKeys.isCopy(event) && term.hasSelection()) {
        void navigator.clipboard?.writeText(term.getSelection());
        return false;
      }
      return true;
    });

    term.onData((data) => sendInput(socketRef.current, data));
    term.onResize(({ cols, rows }) => sendResize(socketRef.current, cols, rows));

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [serviceId]);

  useEffect(() => {
    setStatus('connecting');
    setExitCode(undefined);
    if (generation > 0) termRef.current?.writeln('\r\n[reconnecting...]');

    const ws = new WebSocket(socketUrl(serviceId));
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      fitAddonRef.current?.fit();
      termRef.current?.focus();
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type: string; data?: string; exitCode?: number | null };
        if (message.type === 'ExecOutput' && message.data) {
          const bytes = Uint8Array.from(atob(message.data), (char) => char.charCodeAt(0));
          termRef.current?.write(bytes);
        } else if (message.type === 'ExecExit') {
          setExitCode(message.exitCode ?? null);
          termRef.current?.writeln(`\r\n[process exited${message.exitCode == null ? '' : ` with code ${message.exitCode}`}]`);
          setStatus('closed');
        }
      } catch { setStatus('error'); }
    };
    ws.onerror = () => {
      if (socketRef.current === ws) setStatus('error');
    };
    ws.onclose = () => {
      if (socketRef.current !== ws) return;
      setStatus((current) => (current === 'error' ? current : 'closed'));
    };

    return () => {
      socketRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    };
  }, [serviceId, generation]);

  const isBusy = status === 'connecting';

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="bg-muted/60 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TerminalIcon className="size-4" aria-hidden="true" /> Container shell
          <span className="text-muted-foreground inline-flex items-center gap-1.5 font-normal">
            <span className={cn('size-2 rounded-full', STATUS_DOT[status])} aria-hidden="true" />
            {status === 'closed' && exitCode !== undefined ? 'session ended' : status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => termRef.current?.clear()} title="Clear the view (does not affect the shell)">
            <Eraser className="size-4" aria-hidden="true" />
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGeneration((value) => value + 1)}>
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            Reconnect
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div
          className="h-[62vh] min-h-[360px] p-3"
          style={{ backgroundColor: TERMINAL_THEME.background }}
          onClick={() => termRef.current?.focus()}
        >
          <div ref={containerRef} className="size-full" />
        </div>
      </CardContent>
    </Card>
  );
}
