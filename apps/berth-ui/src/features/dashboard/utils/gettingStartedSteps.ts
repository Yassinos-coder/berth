export interface GettingStartedInput {
  serversOnline: number;
  githubConnected: boolean;
  serviceCount: number;
  proxyHostCount: number;
  channelCount: number;
}

export interface GettingStartedStep {
  id: string;
  title: string;
  description: string;
  to: string;
  done: boolean;
}

export class GettingStartedSteps {
  static compute(input: GettingStartedInput): GettingStartedStep[] {
    return [
      {
        id: 'server',
        title: 'Connect a server',
        description: 'Add a VPS so Berth has somewhere to run your apps.',
        to: '/servers',
        done: input.serversOnline > 0,
      },
      {
        id: 'github',
        title: 'Connect GitHub',
        description: 'Deploy from a repository and redeploy on every push.',
        to: '/settings',
        done: input.githubConnected,
      },
      {
        id: 'service',
        title: 'Deploy your first service',
        description: 'Start from a repo, a Docker image, a database or a template.',
        to: '/services/new',
        done: input.serviceCount > 0,
      },
      {
        id: 'domain',
        title: 'Add a domain',
        description: 'Point a domain at a service with automatic HTTPS.',
        to: '/proxy-hosts',
        done: input.proxyHostCount > 0,
      },
      {
        id: 'alerts',
        title: 'Get notified',
        description: 'Send deploy failures and resource alerts to Slack, Discord or email.',
        to: '/settings',
        done: input.channelCount > 0,
      },
    ];
  }

  static remaining(steps: GettingStartedStep[]): GettingStartedStep[] {
    return steps.filter((step) => !step.done);
  }
}
