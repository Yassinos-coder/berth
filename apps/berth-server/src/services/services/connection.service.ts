import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceRepository } from '../repositories/service.repository';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { DATABASE_TEMPLATES } from '../../common/database/database-catalog';
import type { ConnectionDto, ConnectionVariable } from '../interfaces';

@Injectable()
export class ConnectionService {
  constructor(
    private readonly repository: ServiceRepository,
    private readonly cipher: SecretCipher,
  ) {}

  async get(orgId: string, id: string): Promise<ConnectionDto> {
    const service = await this.repository.findWithConnection(orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const variables: ConnectionVariable[] = service.envVars.map((envVar) => ({
      key: envVar.key,
      value: this.cipher.decrypt(envVar.value),
      isSecret: envVar.isSecret,
    }));

    const template = service.templateKind
      ? DATABASE_TEMPLATES[service.templateKind]
      : undefined;

    if (!template || !service.containerPort) {
      return {
        available: false,
        publicNetworking: service.publicNetworking,
        variables,
      };
    }

    const envMap = new Map(variables.map((item) => [item.key, item.value]));
    const username = template.usernameEnv
      ? envMap.get(template.usernameEnv)
      : undefined;
    const password = template.passwordEnv
      ? envMap.get(template.passwordEnv)
      : undefined;
    const database = template.databaseEnv
      ? envMap.get(template.databaseEnv)
      : undefined;

    const host = service.name;
    const port = service.containerPort;
    const publicHost = this.publicHost(service.server.ip);

    const kind = service.templateKind as string;
    const privateUrl = this.buildUrl(
      template.scheme,
      kind,
      username,
      password,
      host,
      port,
      database,
    );
    const publicUrl =
      service.publicNetworking && publicHost
        ? this.buildUrl(
            template.scheme,
            kind,
            username,
            password,
            publicHost,
            port,
            database,
          )
        : undefined;

    return {
      available: true,
      publicNetworking: service.publicNetworking,
      scheme: template.scheme,
      username,
      password,
      database,
      host,
      port,
      privateUrl,
      publicUrl,
      variables,
    };
  }

  private publicHost(ip: string): string | undefined {
    return ip && ip !== '—' ? ip : undefined;
  }

  private buildUrl(
    scheme: string,
    kind: string,
    username: string | undefined,
    password: string | undefined,
    host: string,
    port: number,
    database: string | undefined,
  ): string {
    if (kind === 'redis') {
      return `redis://:${password ?? ''}@${host}:${port}`;
    }
    const auth = username ? `${username}:${password ?? ''}@` : '';
    const path = database ? `/${database}` : '';
    const suffix = kind === 'mongo' ? '?authSource=admin' : '';
    return `${scheme}://${auth}${host}:${port}${path}${suffix}`;
  }
}
