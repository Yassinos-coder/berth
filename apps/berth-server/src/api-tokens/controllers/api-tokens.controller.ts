import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTokensService } from '../services/api-tokens.service';
import { CreateApiTokenDto } from '../dto/create-api-token.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { ApiTokenDto, CreatedApiTokenDto } from '../interfaces';

@Controller('api-tokens')
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ApiTokenDto[]> {
    return this.apiTokensService.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiTokenDto,
  ): Promise<CreatedApiTokenDto> {
    return this.apiTokensService.create(user, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.apiTokensService.remove(user, id);
  }
}
