import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { RegistryService } from '../services/registry.service';
import type { RegistryImageDto, RegistryTagDto } from '../interfaces';

@Controller('registry')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get('search')
  search(@Query('q') query?: string): Promise<RegistryImageDto[]> {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    return this.registryService.search(trimmed);
  }

  @Get('tags')
  tags(@Query('image') image?: string): Promise<RegistryTagDto[]> {
    const trimmed = image?.trim();
    if (!trimmed) throw new BadRequestException('image is required');
    return this.registryService.tags(trimmed);
  }
}
