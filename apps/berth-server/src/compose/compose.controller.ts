import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { ComposeService } from './compose.service';
import { ImportComposeDto } from './dto/import-compose.dto';

@Controller('compose')
export class ComposeController {
  constructor(private readonly compose: ComposeService) {}
  @Roles(Role.owner, Role.admin, Role.deployer) @Post('preview') preview(@Body() dto: ImportComposeDto) { return this.compose.preview(dto.document); }
  @Roles(Role.owner, Role.admin, Role.deployer) @Post('import') import(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportComposeDto) { return this.compose.import(user, dto); }
}
