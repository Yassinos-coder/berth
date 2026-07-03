export interface TemplateDto {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'storage' | 'cache' | 'app' | 'tooling';
  icon: string;
  accent: string;
  official: boolean;
}

export const TEMPLATES: TemplateDto[] = [
  {
    id: 'tpl_postgres',
    name: 'PostgreSQL',
    description:
      'Managed Postgres with a persistent volume and generated credentials.',
    category: 'database',
    icon: 'Database',
    accent: '#3E6FB0',
    official: true,
  },
  {
    id: 'tpl_redis',
    name: 'Redis',
    description: 'In-memory cache & message broker, persisted to disk.',
    category: 'cache',
    icon: 'Zap',
    accent: '#D64B3C',
    official: true,
  },
  {
    id: 'tpl_mysql',
    name: 'MySQL',
    description: 'MySQL 8 relational database with a data volume.',
    category: 'database',
    icon: 'Database',
    accent: '#C9922B',
    official: true,
  },
  {
    id: 'tpl_minio',
    name: 'MinIO Bucket',
    description: 'S3-compatible object storage for assets and backups.',
    category: 'storage',
    icon: 'Box',
    accent: '#C4372B',
    official: true,
  },
  {
    id: 'tpl_mongo',
    name: 'MongoDB',
    description: 'Document database with replica-ready configuration.',
    category: 'database',
    icon: 'Leaf',
    accent: '#3FA037',
    official: true,
  },
  {
    id: 'tpl_rabbitmq',
    name: 'RabbitMQ',
    description: 'Message queue with the management dashboard enabled.',
    category: 'tooling',
    icon: 'Rabbit',
    accent: '#E4761B',
    official: true,
  },
];
