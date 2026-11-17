const MAX_LENGTH = 2000;

export class ReleaseCommandRules {
  static error(command: string): string | null {
    if (command.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
    if (/[\u0000-\u001f\u007f]/.test(command)) return 'Use a single line.';
    return null;
  }
}
