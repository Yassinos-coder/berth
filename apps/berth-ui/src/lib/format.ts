export class Format {
  static bytes(mb: number): string {
    if (mb < 1024) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  }

  static cpu(cores: number): string {
    return cores < 1 ? `${Math.round(cores * 1000)}m` : `${cores} vCPU`;
  }

  static percent(value: number): string {
    return `${Math.round(value)}%`;
  }

  static relativeTime(input: string | number | Date): string {
    const date = new Date(input);
    const diffMs = date.getTime() - Date.now();
    const abs = Math.abs(diffMs);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000000],
      ['month', 2592000000],
      ['day', 86400000],
      ['hour', 3600000],
      ['minute', 60000],
      ['second', 1000],
    ];
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const [unit, ms] of units) {
      if (abs >= ms || unit === 'second') {
        return rtf.format(Math.round(diffMs / ms), unit);
      }
    }
    return 'just now';
  }

  static dateTime(input: string | number | Date): string {
    return new Date(input).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  static duration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  static shortId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 12)}` : id;
  }

  static commit(sha: string): string {
    return sha.slice(0, 7);
  }
}
