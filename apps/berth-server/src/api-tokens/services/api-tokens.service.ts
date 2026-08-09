import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiTokenRepository } from '../repositories/api-token.repository';
import { ApiTokenMapper } from '../mappers/api-token.mapper';
import { ApiTokenGenerator } from '../utils/api-token.util';
import { CreateApiTokenDto } from '../dto/create-api-token.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type {
  ApiTokenDto,
  AuthenticatedApiToken,
  CreatedApiTokenDto,
} from '../interfaces';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ApiTokensService {
  constructor(private readonly repository: ApiTokenRepository) {}

  async list(user: AuthenticatedUser): Promise<ApiTokenDto[]> {
    const tokens = await this.repository.listForUser(user.orgId, user.id);
    return tokens.map(ApiTokenMapper.toDto);
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateApiTokenDto,
  ): Promise<CreatedApiTokenDto> {
    const generated = ApiTokenGenerator.generate();
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * MS_PER_DAY)
      : null;

    const token = await this.repository.create({
      orgId: user.orgId,
      userId: user.id,
      name: dto.name,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      expiresAt,
    });

    return { ...ApiTokenMapper.toDto(token), token: generated.token };
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const deleted = await this.repository.delete(user.orgId, user.id, id);
    if (!deleted) throw new NotFoundException('API token not found');
  }

  async resolveForAuth(token: string): Promise<AuthenticatedApiToken | null> {
    const hash = ApiTokenGenerator.hash(token);
    const record = await this.repository.findByHash(hash);
    if (!record) return null;
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      return null;
    }

    void this.repository.touchLastUsed(record.id);
    return {
      id: record.id,
      orgId: record.orgId,
      userId: record.userId,
      role: record.user.role,
      expiresAt: record.expiresAt,
    };
  }
}
