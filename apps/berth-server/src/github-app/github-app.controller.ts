import { Controller, Get, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { GithubAppService } from './github-app.service';

@Controller('github')
export class GithubAppController {
  constructor(private readonly github: GithubAppService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.github.status(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Get('manifest')
  manifest(@CurrentUser() user: AuthenticatedUser) {
    return this.github.buildManifest(user.id);
  }

  @Public()
  @Get('manifest/callback')
  async manifestCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    await this.github.convertManifest(code, state);
    response.redirect('/settings?github=created');
  }

  @Get('install')
  install(@CurrentUser() user: AuthenticatedUser) {
    return this.github.buildInstallUrl(user.orgId).then((url) => ({ url }));
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

  @Get('tree')
  tree(
    @CurrentUser() user: AuthenticatedUser,
    @Query('repo') repo: string,
    @Query('branch') branch: string,
  ) {
    return this.github.getTree(user.orgId, repo, branch);
  }
}
