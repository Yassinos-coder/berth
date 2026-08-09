import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request, CookieOptions } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { MfaVerifyDto } from '../dto/mfa-verify.dto';
import { TotpConfirmDto } from '../dto/totp-confirm.dto';
import { TotpDisableDto } from '../dto/totp-disable.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type {
  ActiveSessionDto,
  AuthUserDto,
  InvitePreviewDto,
  RecoveryCodesDto,
  SessionContext,
  SetupStateDto,
  TotpSetupDto,
  TotpStatusDto,
} from '../interfaces';

const SESSION_COOKIE = 'berth_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MFA_COOKIE = 'berth_mfa';
const MFA_MAX_AGE = 5 * 60 * 1000;

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.BERTH_COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };
}

function mfaCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.BERTH_COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: MFA_MAX_AGE,
    path: '/',
  };
}

function sessionContext(req: Request): SessionContext {
  return {
    userAgent: req.headers['user-agent'] ?? '',
    ip: req.ip ?? req.socket.remoteAddress ?? '',
  };
}

function readCookie(req: Request, name: string): string | undefined {
  return (req as Request & { cookies?: Record<string, string> }).cookies?.[
    name
  ];
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('setup-state')
  setupState(): Promise<SetupStateDto> {
    return this.authService.setupState();
  }

  @Public()
  @Get('github/authorize')
  githubAuthorize(): { url: string } {
    return this.authService.githubAuthorizeUrl();
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.getUser(user.id);
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const { user, token } = await this.authService.register(
      dto,
      sessionContext(req),
    );
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto } | { mfaRequired: true }> {
    const outcome = await this.authService.login(dto, sessionContext(req));
    if (outcome.mfaRequired) {
      res.cookie(MFA_COOKIE, outcome.mfaToken, mfaCookieOptions());
      return { mfaRequired: true };
    }
    res.cookie(SESSION_COOKIE, outcome.session.token, sessionCookieOptions());
    return { user: outcome.session.user };
  }

  @Public()
  @Post('login/verify-mfa')
  @HttpCode(200)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const mfaToken = readCookie(req, MFA_COOKIE);
    if (!mfaToken) {
      throw new UnauthorizedException('MFA challenge expired, log in again');
    }

    const session = await this.authService.verifyMfaChallenge(
      mfaToken,
      dto,
      sessionContext(req),
    );
    res.clearCookie(MFA_COOKIE, { path: '/' });
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions());
    return { user: session.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    await this.authService.logout(readCookie(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(MFA_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Public()
  @Get('invite/:token')
  previewInvite(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.authService.previewInvite(token);
  }

  @Public()
  @Post('accept-invite')
  @HttpCode(200)
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const session = await this.authService.acceptInvite(
      dto.token,
      dto.password,
      sessionContext(req),
    );
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions());
    return { user: session.user };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: boolean }> {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Public()
  @Get('reset-password/:token')
  previewResetToken(@Param('token') token: string): Promise<{ email: string }> {
    return this.authService.previewResetToken(token);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const session = await this.authService.resetPassword(
      dto.token,
      dto.password,
      sessionContext(req),
    );
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions());
    return { user: session.user };
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ActiveSessionDto[]> {
    const currentId = this.authService.currentSessionId(
      readCookie(req, SESSION_COOKIE),
    );
    return this.authService.listSessions(user.id, currentId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.authService.revokeSession(user.id, id);
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ revoked: number }> {
    const currentId = this.authService.currentSessionId(
      readCookie(req, SESSION_COOKIE),
    );
    if (!currentId) {
      throw new UnauthorizedException('Session expired, log in again');
    }
    const revoked = await this.authService.revokeOtherSessions(
      user.id,
      currentId,
    );
    return { revoked };
  }

  @Get('2fa/status')
  totpStatus(@CurrentUser() user: AuthenticatedUser): Promise<TotpStatusDto> {
    return this.authService.totpStatus(user.id);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  setupTotp(@CurrentUser() user: AuthenticatedUser): Promise<TotpSetupDto> {
    return this.authService.setupTotp(user.id);
  }

  @Post('2fa/confirm')
  @HttpCode(200)
  confirmTotp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TotpConfirmDto,
  ): Promise<RecoveryCodesDto> {
    return this.authService.confirmTotp(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  async disableTotp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TotpDisableDto,
  ): Promise<{ ok: boolean }> {
    await this.authService.disableTotp(user.id, dto.password);
    return { ok: true };
  }

  @Post('2fa/recovery-codes/regenerate')
  @HttpCode(200)
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TotpDisableDto,
  ): Promise<RecoveryCodesDto> {
    return this.authService.regenerateRecoveryCodes(user.id, dto.password);
  }
}
