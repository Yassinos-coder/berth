import type { BerthConfig } from '@/interfaces';

interface ExecFrame {
  type: string;
  data?: string;
}

export class ShellSession {
  static url(config: BerthConfig, serviceId: string): string {
    return `${config.url.replace(/^http/, 'ws')}/api/services/${encodeURIComponent(serviceId)}/exec`;
  }

  static protocol(token: string): string {
    return `berth.token.${Buffer.from(token).toString('base64url')}`;
  }

  static decode(raw: string): Buffer | null {
    let frame: ExecFrame;
    try {
      frame = JSON.parse(raw) as ExecFrame;
    } catch {
      return null;
    }
    if (frame.type !== 'ExecOutput' || !frame.data) return null;
    return Buffer.from(frame.data, 'base64');
  }

  static encodeInput(chunk: Buffer): string {
    return JSON.stringify({ type: 'input', data: chunk.toString('base64') });
  }

  static encodeResize(cols: number, rows: number): string {
    return JSON.stringify({ type: 'resize', cols, rows });
  }

  static open(config: BerthConfig, serviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url(config, serviceId), this.protocol(config.token));
      const stdin = process.stdin;

      const restore = () => stdin.setRawMode?.(false);
      const sendSize = () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(this.encodeResize(process.stdout.columns || 80, process.stdout.rows || 24));
      };

      socket.addEventListener('open', () => {
        stdin.setRawMode?.(true);
        stdin.resume();
        stdin.on('data', (chunk: Buffer) => socket.send(this.encodeInput(chunk)));
        process.stdout.on('resize', sendSize);
        sendSize();
      });

      socket.addEventListener('message', (event) => {
        const output = this.decode(String(event.data));
        if (output) process.stdout.write(output);
      });

      socket.addEventListener('close', () => {
        restore();
        stdin.pause();
        resolve();
      });

      socket.addEventListener('error', () => {
        restore();
        reject(new Error('Shell connection failed. Check the service is running and your token role allows it.'));
      });
    });
  }
}
