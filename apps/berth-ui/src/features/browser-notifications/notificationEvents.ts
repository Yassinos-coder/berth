import type { Deployment, DeploymentStatus, Service } from '@/interfaces';
import type { BrowserNotice } from '@/features/browser-notifications/browserNotifications';

export interface NotifierSnapshot {
  deployments: Map<string, DeploymentStatus>;
  services: Map<string, string>;
}

const IN_FLIGHT: DeploymentStatus[] = ['queued', 'building', 'deploying'];

export class NotificationEvents {
  static snapshot(deployments: Deployment[], services: Service[]): NotifierSnapshot {
    return {
      deployments: new Map(deployments.map((deployment) => [deployment.id, deployment.status])),
      services: new Map(services.map((service) => [service.id, service.state])),
    };
  }

  static diff(
    previous: NotifierSnapshot,
    deployments: Deployment[],
    services: Service[],
  ): BrowserNotice[] {
    const notices: BrowserNotice[] = [];

    for (const deployment of deployments) {
      const before = previous.deployments.get(deployment.id);
      if (!before || !IN_FLIGHT.includes(before) || before === deployment.status) continue;
      if (deployment.status === 'live') {
        notices.push({
          title: `${deployment.serviceName} is live`,
          body: deployment.commitMessage ?? 'The deployment finished successfully.',
          tag: `deployment-${deployment.id}`,
          url: `/services/${deployment.serviceId}`,
        });
      }
      if (deployment.status === 'failed') {
        notices.push({
          title: `${deployment.serviceName} failed to deploy`,
          body: deployment.commitMessage ?? 'The build or start failed. Open the logs to see why.',
          tag: `deployment-${deployment.id}`,
          url: `/services/${deployment.serviceId}`,
        });
      }
    }

    for (const service of services) {
      const before = previous.services.get(service.id);
      if (before === undefined || before === 'crashed' || service.state !== 'crashed') continue;
      notices.push({
        title: `${service.name} crashed`,
        body: 'The service stopped unexpectedly.',
        tag: `crash-${service.id}`,
        url: `/services/${service.id}`,
      });
    }

    return notices;
  }
}
