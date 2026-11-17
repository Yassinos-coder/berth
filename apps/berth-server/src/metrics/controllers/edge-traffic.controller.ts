import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { EdgeTrafficDto } from '../interfaces';
import { EdgeTrafficService } from '../services/edge-traffic.service';

@Controller('services')
export class EdgeTrafficController {
  constructor(private readonly traffic: EdgeTrafficService) {}

  @Get(':id/traffic')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('range') range?: string,
  ): Promise<EdgeTrafficDto> {
    return this.traffic.traffic(user.orgId, id, range);
  }
}
