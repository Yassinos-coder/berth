import type { SourceChoice } from '@/features/services/newServiceOptions';

export interface StorageGuidance {
  mode: 'managed' | 'optional';
  defaultGb: number;
  presets: number[];
  title: string;
  body: string;
}

interface GuidanceInput {
  choice: SourceChoice | null;
  templateKind?: string;
  managedDatabase: boolean;
  appTemplate: boolean;
}

const DATABASE_DEFAULTS: Record<string, number> = { redis: 1, postgres: 5, mysql: 5, mariadb: 5, mongodb: 10 };

export class StorageGuidanceRules {
  static forDeployment(input: GuidanceInput): StorageGuidance {
    if (input.choice === 'bucket') {
      return {
        mode: 'managed',
        defaultGb: 10,
        presets: [5, 10, 25, 50, 100],
        title: 'Storage for your files',
        body: 'Every file you upload lives in this volume, so size it for the data you expect. You can grow it later with a short restart.',
      };
    }
    if (input.managedDatabase) {
      const defaultGb = DATABASE_DEFAULTS[input.templateKind ?? ''] ?? 5;
      return {
        mode: 'managed',
        defaultGb,
        presets: [1, 5, 10, 25, 50],
        title: 'Database storage',
        body: 'The database keeps its data here. Size it for your data plus room to grow. It cannot exceed this size, and you can grow it later with a short restart.',
      };
    }
    if (input.appTemplate) {
      return {
        mode: 'managed',
        defaultGb: 2,
        presets: [1, 2, 5, 10, 25],
        title: 'App data',
        body: 'This app stores its settings and files here.',
      };
    }
    return {
      mode: 'optional',
      defaultGb: 5,
      presets: [1, 5, 10, 25, 50],
      title: 'Persistent storage',
      body: 'A stateless backend or website does not need this: keep its data in a database or object storage. Turn it on only if the app writes files that must survive a redeploy, such as uploads or a SQLite database. Images and build cache use a separate reserve.',
    };
  }
}
