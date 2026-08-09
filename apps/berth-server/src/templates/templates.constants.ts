export interface TemplateDto {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'storage' | 'cache' | 'app' | 'tooling';
  icon: string;
  accent: string;
  official: boolean;
  kind: string;
}

export const TEMPLATES: TemplateDto[] = [
  { id: 'tpl_mariadb', name: 'MariaDB', description: 'Community MySQL-compatible relational database.', category: 'database', icon: 'Database', accent: '#B38B70', official: true, kind: 'mariadb' },
  { id: 'tpl_timescaledb', name: 'TimescaleDB', description: 'PostgreSQL optimized for time-series workloads.', category: 'database', icon: 'Database', accent: '#FDB515', official: true, kind: 'timescaledb' },
  { id: 'tpl_couchdb', name: 'CouchDB', description: 'Replicating JSON document database with an HTTP API.', category: 'database', icon: 'Database', accent: '#E42528', official: true, kind: 'couchdb' },
  { id: 'tpl_valkey', name: 'Valkey', description: 'Open-source in-memory cache and data store.', category: 'cache', icon: 'Zap', accent: '#8A2BE2', official: true, kind: 'valkey' },
  { id: 'tpl_keydb', name: 'KeyDB', description: 'Multithreaded Redis-compatible database.', category: 'cache', icon: 'Zap', accent: '#5B6CFF', official: true, kind: 'keydb' },
  {
    id: 'tpl_postgres',
    name: 'PostgreSQL',
    description:
      'Managed Postgres with a persistent volume and generated credentials.',
    category: 'database',
    icon: 'Database',
    accent: '#3E6FB0',
    official: true,
    kind: 'postgres',
  },
  {
    id: 'tpl_redis',
    name: 'Redis',
    description: 'In-memory cache & message broker, persisted to disk.',
    category: 'cache',
    icon: 'Zap',
    accent: '#D64B3C',
    official: true,
    kind: 'redis',
  },
  {
    id: 'tpl_mysql',
    name: 'MySQL',
    description: 'MySQL 8 relational database with a data volume.',
    category: 'database',
    icon: 'Database',
    accent: '#C9922B',
    official: true,
    kind: 'mysql',
  },
  {
    id: 'tpl_minio',
    name: 'MinIO Bucket',
    description: 'S3-compatible object storage for assets and backups.',
    category: 'storage',
    icon: 'Box',
    accent: '#C4372B',
    official: true,
    kind: 'minio',
  },
  {
    id: 'tpl_mongo',
    name: 'MongoDB',
    description: 'Document database with replica-ready configuration.',
    category: 'database',
    icon: 'Leaf',
    accent: '#3FA037',
    official: true,
    kind: 'mongo',
  },
  {
    id: 'tpl_rabbitmq',
    name: 'RabbitMQ',
    description: 'Message queue with the management dashboard enabled.',
    category: 'tooling',
    icon: 'Rabbit',
    accent: '#E4761B',
    official: true,
    kind: 'rabbitmq',
  },
];
