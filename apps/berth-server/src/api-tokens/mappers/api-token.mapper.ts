import { ApiToken } from '@prisma/client';
import type { ApiTokenDto } from '../interfaces';

export class ApiTokenMapper {
  static toDto(token: ApiToken): ApiTokenDto {
    return {
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
    };
  }
}
