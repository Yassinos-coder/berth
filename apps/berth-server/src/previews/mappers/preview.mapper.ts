import type { Service } from '@prisma/client';
import type { PullRequestEvent } from '../interfaces';

export class PreviewMapper {
  static name(parentName: string, pr: Pick<PullRequestEvent, 'number'>): string {
    return `${parentName}-pr-${pr.number}`;
  }

  static domain(parentDomain: string, pr: Pick<PullRequestEvent, 'number'>): string {
    return `pr-${pr.number}.${parentDomain}`;
  }

  static toCreateData(parent: Service, pr: PullRequestEvent, internalDomain: string) {
    return {
      orgId: parent.orgId,
      serverId: parent.serverId,
      name: PreviewMapper.name(parent.name, pr),
      kind: parent.kind,
      sourceKind: parent.sourceKind,
      repo: parent.repo,
      branch: pr.headRef,
      builder: parent.builder,
      dockerfilePath: parent.dockerfilePath,
      rootDirectory: parent.rootDirectory,
      buildCommand: parent.buildCommand,
      startCommand: parent.startCommand,
      command: parent.command,
      cpuCores: parent.cpuCores,
      memoryMb: parent.memoryMb,
      cpuShares: parent.cpuShares,
      containerPort: parent.containerPort,
      publicNetworking: parent.publicNetworking,
      registryCredentialId: parent.registryCredentialId,
      targetPlatform: parent.targetPlatform,
      environmentId: parent.environmentId,
      internalDomains: [internalDomain],
      specHash: pr.headSha,
      previewOfId: parent.id,
      prNumber: pr.number,
    };
  }
}
