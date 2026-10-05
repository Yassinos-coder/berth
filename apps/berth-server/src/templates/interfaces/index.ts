export type TemplateCategory = 'database' | 'storage' | 'cache' | 'app' | 'tooling';

export interface AppTemplateEnv {
  key: string;
  value?: string;
  generate?: boolean;
  isSecret?: boolean;
}

export interface AppTemplate {
  kind: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  accent: string;
  image: string;
  defaultTag: string;
  port: number;
  volumePath?: string;
  env?: AppTemplateEnv[];
  command?: string[];
}
