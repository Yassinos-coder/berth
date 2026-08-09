import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiTokensService } from '../../api-tokens/services/api-tokens.service';
import { ApiTokenGenerator } from '../../api-tokens/utils/api-token.util';
import { SessionRepository } from '../../auth/repositories/session.repository';
import type {
  JwtPayload,
  MfaChallengePayload,
  RequestWithUser,
} from '../interfaces';

const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly apiTokensService: ApiTokensService,
    private readonly sessions: SessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    if (ApiTokenGenerator.isApiToken(token)) {
      const apiToken = await this.apiTokensService.resolveForAuth(token);
      if (!apiToken) throw new UnauthorizedException('Invalid or expired API token');
      request.user = {
        id: apiToken.userId,
        orgId: apiToken.orgId,
        role: apiToken.role,
      };
      return true;
    }

    let payload: JwtPayload | MfaChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload | MfaChallengePayload>(
        token,
        { secret: this.configService.get<string>('jwtSecret') },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type === 'mfa_challenge') {
      throw new UnauthorizedException('MFA verification required');
    }
    if (!payload.sid) {
      throw new UnauthorizedException('Session expired, log in again');
    }

    const session = await this.sessions.findById(payload.sid);
    if (!session) {
      throw new UnauthorizedException('Session revoked, log in again');
    }
    if (Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      void this.sessions.touchLastSeen(session.id);
    }

    request.user = {
      id: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const cookies = (request as Request & { cookies?: Record<string, string> })
      .cookies;
    const cookieToken = cookies?.['berth_session'];
    if (cookieToken) return cookieToken;

    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
