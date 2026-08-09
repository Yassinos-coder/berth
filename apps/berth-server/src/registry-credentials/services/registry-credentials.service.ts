import { Injectable, NotFoundException } from '@nestjs/common';
import { RegistryCredentialRepository } from '../repositories/registry-credential.repository';
import { RegistryCredentialMapper } from '../mappers/registry-credential.mapper';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { CreateRegistryCredentialDto } from '../dto/create-registry-credential.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { RegistryCredentialDto, ResolvedRegistryAuth } from '../interfaces';

@Injectable()
export class RegistryCredentialsService {
  constructor(
    private readonly repository: RegistryCredentialRepository,
    private readonly secretCipher: SecretCipher,
  ) {}

  async list(orgId: string): Promise<RegistryCredentialDto[]> {
    const credentials = await this.repository.listByOrg(orgId);
    return credentials.map(RegistryCredentialMapper.toDto);
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateRegistryCredentialDto,
  ): Promise<RegistryCredentialDto> {
    const credential = await this.repository.create({
      orgId: user.orgId,
      name: dto.name,
      server: dto.server?.trim() ?? '',
      username: dto.username,
      passwordEncrypted: this.secretCipher.encrypt(dto.password),
    });
    return RegistryCredentialMapper.toDto(credential);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const deleted = await this.repository.delete(orgId, id);
    if (!deleted) throw new NotFoundException('Registry credential not found');
  }

  async resolveAuth(
    orgId: string,
    id: string,
  ): Promise<ResolvedRegistryAuth | null> {
    const credential = await this.repository.findById(orgId, id);
    if (!credential) return null;
    return {
      server: credential.server,
      username: credential.username,
      password: this.secretCipher.decrypt(credential.passwordEncrypted),
    };
  }
}
