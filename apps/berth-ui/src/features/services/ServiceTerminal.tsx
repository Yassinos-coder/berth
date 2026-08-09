import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Status = 'connecting' | 'connected' | 'closed' | 'error';

function socketUrl(serviceId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/services/${encodeURIComponent(serviceId)}/exec`;
}

export function ServiceTerminal({ serviceId }: { serviceId: string }) {
  const socket = useRef<WebSocket | null>(null);
  const output = useRef<HTMLPreElement | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [text, setText] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setStatus('connecting');
    setText('');
    const ws = new WebSocket(socketUrl(serviceId));
    socket.current = ws;
    ws.onopen = () => setStatus('connected');
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type: string; data?: string; exitCode?: number | null };
        if (message.type === 'ExecOutput' && message.data) {
          const bytes = Uint8Array.from(atob(message.data), (char) => char.charCodeAt(0));
          setText((current) => current + new TextDecoder().decode(bytes));
        } else if (message.type === 'ExecExit') {
          setText((current) => `${current}\r\n[process exited${message.exitCode == null ? '' : ` with code ${message.exitCode}`}]\r\n`);
          setStatus('closed');
        }
      } catch { setStatus('error'); }
    };
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus((current) => current === 'error' ? current : 'closed');
    return () => { socket.current = null; ws.close(); };
  }, [serviceId, generation]);

  useEffect(() => {
    output.current?.scrollTo({ top: output.current.scrollHeight });
  }, [text]);

  const send = (data: string) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    const bytes = new TextEncoder().encode(data);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    socket.current.send(JSON.stringify({ type: 'input', data: btoa(binary) }));
  };

  return (
    <Card className="overflow-hidden py-0">
      <div className="bg-muted/60 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="size-4" /> Container shell
          <span className="text-muted-foreground font-normal">{status}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setGeneration((value) => value + 1)}>
          {status === 'connecting' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Reconnect
        </Button>
      </div>
      <CardContent className="p-0">
        <pre
          ref={output}
          tabIndex={0}
          role="textbox"
          aria-label="Interactive container terminal"
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'c') send('\u0003');
            else if (event.key === 'Enter') send('\n');
            else if (event.key === 'Backspace') send('\u007f');
            else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) send(event.key);
            else return;
            event.preventDefault();
          }}
          className="h-[480px] overflow-auto bg-zinc-950 p-4 font-mono text-sm whitespace-pre-wrap text-zinc-100 outline-none focus:ring-2 focus:ring-primary/50"
        >
          {text || (status === 'connecting' ? 'Connecting…' : 'Click here and type to use the shell.\r\n')}
        </pre>
      </CardContent>
    </Card>
  );
}
