import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { GithubAppService } from './github-app.service';

@Controller('github')
export class GithubAppController {
  constructor(private readonly github: GithubAppService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.github.status(user.orgId);
  }

  @Get('install')
  install(@CurrentUser() user: AuthenticatedUser) {
    return { url: this.github.buildInstallUrl(user.orgId) };
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('installation_id') installationId: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    await this.github.completeInstallation(state, Number(installationId));
    response.redirect('/settings?github=connected');
  }

  @Get('repositories')
  repositories(@CurrentUser() user: AuthenticatedUser) {
    return this.github.listRepos(user.orgId);
  }

  @Get('branches')
  branches(
    @CurrentUser() user: AuthenticatedUser,
    @Query('repo') repo: string,
  ) {
    return this.github.listBranches(user.orgId, repo);
  }
}
