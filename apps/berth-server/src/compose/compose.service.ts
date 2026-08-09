import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceKind } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces';
import { ServicesService } from '../services/services/services.service';
import type { ImportComposeDto } from './dto/import-compose.dto';
import { parseCompose } from './compose-parser';

@Injectable()
export class ComposeService {
  constructor(private readonly services: ServicesService) {}
  preview(document: string) { return parseCompose(document); }
  async import(user: AuthenticatedUser, dto: ImportComposeDto) {
    const specs = parseCompose(dto.document);
    const created = [];
    for (const spec of specs) {
      if (!spec.image) throw new BadRequestException(`${spec.name}: build-only services require a repository and cannot be imported directly`);
      const separator = spec.image.lastIndexOf(':');
      const hasTag = separator > spec.image.lastIndexOf('/');
      const image = hasTag ? spec.image.slice(0, separator) : spec.image;
      const tag = hasTag ? spec.image.slice(separator + 1) : 'latest';
      created.push(await this.services.create(user, { name: spec.name, kind: ServiceKind.image, serverId: dto.serverId, resources: { cpuCores: 1, memoryMb: 512 }, source: { kind: 'image', image, tag }, publicNetworking: spec.ports.length > 0, containerPort: spec.ports[0]?.container, command: spec.command, env: spec.environment.map((item) => ({ ...item, isSecret: false })) }));
    }
    return created;
  }
}
