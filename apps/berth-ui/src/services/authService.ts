import { BaseApiClient } from '@/services/baseApiClient';
import type {
  ActiveSession,
  AuthUser,
  RecoveryCodes,
  TotpSetup,
  TotpStatus,
} from '@/interfaces';

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends Credentials {
  name: string;
}

export interface Session {
  user: AuthUser;
}

export type LoginResult = { user: AuthUser } | { mfaRequired: true };

export interface MfaVerifyPayload {
  code?: string;
  recoveryCode?: string;
}

class AuthService extends BaseApiClient {
  protected resource = 'auth';

  needsSetup(): Promise<{ needsSetup: boolean }> {
    return this.get<{ needsSetup: boolean }>('/setup-state');
  }

  me(): Promise<AuthUser> {
    return this.get<AuthUser>('/me');
  }

  register(payload: RegisterPayload): Promise<Session> {
    return this.post<Session>('/register', payload);
  }

  login(payload: Credentials): Promise<LoginResult> {
    return this.post<LoginResult>('/login', payload);
  }

  verifyMfa(payload: MfaVerifyPayload): Promise<Session> {
    return this.post<Session>('/login/verify-mfa', payload);
  }

  logout(): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/logout');
  }

  connectGithub(): Promise<{ url: string }> {
    return this.get<{ url: string }>('/github/authorize');
  }

  totpStatus(): Promise<TotpStatus> {
    return this.get<TotpStatus>('/2fa/status');
  }

  setupTotp(): Promise<TotpSetup> {
    return this.post<TotpSetup>('/2fa/setup');
  }

  confirmTotp(code: string): Promise<RecoveryCodes> {
    return this.post<RecoveryCodes>('/2fa/confirm', { code });
  }

  disableTotp(password: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/2fa/disable', { password });
  }

  regenerateRecoveryCodes(password: string): Promise<RecoveryCodes> {
    return this.post<RecoveryCodes>('/2fa/recovery-codes/regenerate', {
      password,
    });
  }

  sessions(): Promise<ActiveSession[]> {
    return this.get<ActiveSession[]>('/sessions');
  }

  revokeSession(id: string): Promise<void> {
    return this.delete<void>(`/sessions/${id}`);
  }

  revokeOtherSessions(): Promise<{ revoked: number }> {
    return this.post<{ revoked: number }>('/sessions/revoke-others');
  }

  previewInvite(token: string): Promise<{ email: string; name: string }> {
    return this.get<{ email: string; name: string }>(
      `/invite/${encodeURIComponent(token)}`,
    );
  }

  acceptInvite(token: string, password: string): Promise<Session> {
    return this.post<Session>('/accept-invite', { token, password });
  }

  forgotPassword(email: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/forgot-password', { email });
  }

  previewResetToken(token: string): Promise<{ email: string }> {
    return this.get<{ email: string }>(
      `/reset-password/${encodeURIComponent(token)}`,
    );
  }

  resetPassword(token: string, password: string): Promise<Session> {
    return this.post<Session>('/reset-password', { token, password });
  }
}

export const authService = new AuthService();
