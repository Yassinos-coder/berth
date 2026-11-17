import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AdvisorFindingDto, AdvisorSettingsDto, AdvisorSummaryDto } from '@berth/protocol';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import { UpdateAdvisorSettingsDto } from '../dto/update-advisor-settings.dto';
import { AdvisorAnalysisService, type AnalysisOutcome } from '../services/advisor-analysis.service';
import { AdvisorApplyService } from '../services/advisor-apply.service';
import { AdvisorFindingsService } from '../services/advisor-findings.service';
import { AdvisorSettingsService } from '../services/advisor-settings.service';

@Controller('advisor')
export class AdvisorController {
  constructor(
    private readonly settings: AdvisorSettingsService,
    private readonly analysis: AdvisorAnalysisService,
    private readonly findings: AdvisorFindingsService,
    private readonly apply: AdvisorApplyService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser): Promise<AdvisorSummaryDto> {
    return this.findings.summary(user.orgId);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser): Promise<AdvisorSettingsDto> {
    return this.settings.get(user.orgId);
  }

  @Get('findings')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('view') view?: string,
  ): Promise<AdvisorFindingDto[]> {
    return this.findings.list(user.orgId, view === 'history' ? 'history' : 'open');
  }

  @Roles(Role.owner, Role.admin)
  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAdvisorSettingsDto,
  ): Promise<AdvisorSettingsDto> {
    return this.settings.update(user.orgId, dto);
  }

  @Roles(Role.owner, Role.admin)
  @Post('test')
  @HttpCode(200)
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.analysis.testConnection(user.orgId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post('run')
  @HttpCode(200)
  run(@CurrentUser() user: AuthenticatedUser): Promise<AnalysisOutcome> {
    return this.analysis.run(user.orgId, { manual: true });
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post('findings/:id/apply')
  @HttpCode(200)
  applyFinding(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<AdvisorFindingDto> {
    return this.apply.apply(user, id);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post('findings/:id/dismiss')
  @HttpCode(200)
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<AdvisorFindingDto> {
    return this.apply.dismiss(user, id);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post('findings/:id/undo')
  @HttpCode(200)
  undo(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<AdvisorFindingDto> {
    return this.apply.undo(user, id);
  }
}
