import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import type { SessionDto, SetupStateDto } from '../interfaces';

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

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<SessionDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<SessionDto> {
    return this.authService.login(dto);
  }
}
