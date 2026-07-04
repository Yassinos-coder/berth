import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import { Response, CookieOptions } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { AuthUserDto, SetupStateDto } from '../interfaces';

const SESSION_COOKIE = 'berth_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.BERTH_COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const { user, token } = await this.authService.register(dto);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const { user, token } = await this.authService.login(dto);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: boolean } {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }
}
