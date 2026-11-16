import type { AgentIdentitySnapshot } from '../interfaces';

export class AgentIdentityValidator {
  static check(
    server: AgentIdentitySnapshot | null,
    presentedSerial: string | undefined,
  ): string | null {
    if (!server) return 'unknown server';
    if (server.bootstrapToken) return 'certificate revoked: re-enrollment pending';
    if (!server.certSerial) return null;
    if (!presentedSerial) return 'client certificate has no serial';
    if (this.matchesPending(server, presentedSerial)) return null;
    if (this.normalize(server.certSerial) !== this.normalize(presentedSerial)) {
      return 'certificate revoked: superseded by a newer enrollment';
    }
    return null;
  }

  static matchesPending(
    server: AgentIdentitySnapshot,
    presentedSerial: string | undefined,
  ): boolean {
    if (!server.pendingCertSerial || !presentedSerial) return false;
    return (
      this.normalize(server.pendingCertSerial) === this.normalize(presentedSerial)
    );
  }

  private static normalize(serial: string): string {
    return serial.toLowerCase().replace(/^0+/, '');
  }
}
