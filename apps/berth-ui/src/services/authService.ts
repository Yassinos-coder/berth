import { BaseApiClient } from '@/services/baseApiClient';
import type { AuthUser } from '@/interfaces';

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends Credentials {
  name: string;
}

export interface Session {
  user: AuthUser;
  token: string;
}

class AuthService extends BaseApiClient {
  protected resource = 'auth';

  needsSetup(): Promise<{ needsSetup: boolean }> {
    return this.get<{ needsSetup: boolean }>('/setup-state');
  }

  register(payload: RegisterPayload): Promise<Session> {
    return this.post<Session>('/register', payload);
  }

  login(payload: Credentials): Promise<Session> {
    return this.post<Session>('/login', payload);
  }

  connectGithub(): Promise<{ url: string }> {
    return this.get<{ url: string }>('/github/authorize');
  }
}

export const authService = new AuthService();
