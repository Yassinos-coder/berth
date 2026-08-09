import { RegistryCredential } from '@prisma/client';
import type { RegistryCredentialDto } from '../interfaces';

export class RegistryCredentialMapper {
  static toDto(credential: RegistryCredential): RegistryCredentialDto {
    return {
      id: credential.id,
      name: credential.name,
      server: credential.server,
      username: credential.username,
      createdAt: credential.createdAt.toISOString(),
    };
  }
}
