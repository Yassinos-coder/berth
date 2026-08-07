import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import type { AppConfig } from '../config/configuration';
import { GithubAppService } from './github-app.service';
import { GithubInstallationRepository } from './github-installation.repository';

interface InstallState { orgId: string; userId: string }

@Controller('github')
export class GithubAppController {
  constructor(private readonly github: GithubAppService, private readonly installations: GithubInstallationRepository, private readonly config: ConfigService<AppConfig, true>) {}

  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const installation = await this.installations.findByOrg(user.orgId);
    return { configured: this.github.isConfigured(), connected: Boolean(installation), accountLogin: installation?.accountLogin };
  }

  @Get('install')
  install(@CurrentUser() user: AuthenticatedUser) {
    const state = jwt.sign({ orgId: user.orgId, userId: user.id } satisfies InstallState, this.config.getOrThrow<string>('jwtSecret'), { expiresIn: '10m' });
    return { url: this.github.installUrl(state) };
  }

  @Public()
  @Get('callback')
  async callback(@Query('installation_id') installationId: string, @Query('state') state: string, @Res() response: Response) {
    const payload = jwt.verify(state, this.config.getOrThrow<string>('jwtSecret')) as InstallState;
    const numericId = Number(installationId);
    const login = await this.github.accountLogin(numericId);
    await this.installations.upsert(payload.orgId, numericId, login);
    response.redirect('/settings?github=connected');
  }

  @Get('repositories')
  repositories(@CurrentUser() user: AuthenticatedUser) { return this.github.listRepos(user.orgId); }

  @Get('branches')
  branches(@CurrentUser() user: AuthenticatedUser, @Query('repo') repo: string) { return this.github.listBranches(user.orgId, repo); }
}
