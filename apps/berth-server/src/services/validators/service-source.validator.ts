import { BadRequestException } from '@nestjs/common';
import { Builder, ServiceKind, SourceKind } from '@prisma/client';
import { CreateServiceDto } from '../dto/create-service.dto';

export interface NormalizedSource {
  sourceKind: SourceKind;
  image?: string;
  tag?: string;
  repo?: string;
  branch?: string;
  builder?: Builder;
  dockerfilePath?: string;
}

export class ServiceSourceValidator {
  static normalize(dto: CreateServiceDto): NormalizedSource {
    const { source, kind } = dto;
    if (!source) {
      throw new BadRequestException('A source is required');
    }

    if (source.kind === 'git') {
      if (!source.repo) {
        throw new BadRequestException('A git source requires a repository');
      }
      if (kind !== ServiceKind.git) {
        throw new BadRequestException('Git sources must use kind "git"');
      }
      return {
        sourceKind: SourceKind.git,
        repo: source.repo,
        branch: source.branch ?? 'main',
        builder: (source.build?.builder ?? 'auto') as Builder,
        dockerfilePath: source.build?.dockerfilePath,
      };
    }

    if (!source.image) {
      throw new BadRequestException('An image source requires an image');
    }
    return {
      sourceKind: SourceKind.image,
      image: source.image,
      tag: source.tag ?? 'latest',
    };
  }
}
