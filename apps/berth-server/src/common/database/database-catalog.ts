export interface DatabaseTemplate {
  kind: string;
  image: string;
  defaultTag: string;
  port: number;
  scheme: string;
  volumePath: string;
  usernameEnv?: string;
  passwordEnv?: string;
  databaseEnv?: string;
  rootPasswordEnv?: string;
  usesCommandPassword?: boolean;
  command?: string[];
  targetKind?: 'database' | 'bucket';
}

export const DATABASE_TEMPLATES: Record<string, DatabaseTemplate> = {
  postgres: {
    kind: 'postgres',
    image: 'postgres',
    defaultTag: '16-alpine',
    port: 5432,
    scheme: 'postgresql',
    volumePath: '/var/lib/postgresql/data',
    usernameEnv: 'POSTGRES_USER',
    passwordEnv: 'POSTGRES_PASSWORD',
    databaseEnv: 'POSTGRES_DB',
  },
  mysql: {
    kind: 'mysql',
    image: 'mysql',
    defaultTag: '8',
    port: 3306,
    scheme: 'mysql',
    volumePath: '/var/lib/mysql',
    usernameEnv: 'MYSQL_USER',
    passwordEnv: 'MYSQL_PASSWORD',
    databaseEnv: 'MYSQL_DATABASE',
    rootPasswordEnv: 'MYSQL_ROOT_PASSWORD',
  },
  mariadb: {
    kind: 'mariadb',
    image: 'mariadb',
    defaultTag: '11',
    port: 3306,
    scheme: 'mysql',
    volumePath: '/var/lib/mysql',
    usernameEnv: 'MARIADB_USER',
    passwordEnv: 'MARIADB_PASSWORD',
    databaseEnv: 'MARIADB_DATABASE',
    rootPasswordEnv: 'MARIADB_ROOT_PASSWORD',
  },
  mongo: {
    kind: 'mongo',
    image: 'mongo',
    defaultTag: '7',
    port: 27017,
    scheme: 'mongodb',
    volumePath: '/data/db',
    usernameEnv: 'MONGO_INITDB_ROOT_USERNAME',
    passwordEnv: 'MONGO_INITDB_ROOT_PASSWORD',
    databaseEnv: 'MONGO_INITDB_DATABASE',
  },
  redis: {
    kind: 'redis',
    image: 'redis',
    defaultTag: '7-alpine',
    port: 6379,
    scheme: 'redis',
    volumePath: '/data',
    passwordEnv: 'REDIS_PASSWORD',
    usesCommandPassword: true,
  },
  minio: {
    kind: 'minio',
    image: 'minio/minio',
    defaultTag: 'latest',
    port: 9000,
    scheme: 'http',
    volumePath: '/data',
    usernameEnv: 'MINIO_ROOT_USER',
    passwordEnv: 'MINIO_ROOT_PASSWORD',
    command: ['server', '/data', '--console-address', ':9001'],
    targetKind: 'bucket',
  },
  rabbitmq: {
    kind: 'rabbitmq',
    image: 'rabbitmq',
    defaultTag: '3-management-alpine',
    port: 5672,
    scheme: 'amqp',
    volumePath: '/var/lib/rabbitmq',
    usernameEnv: 'RABBITMQ_DEFAULT_USER',
    passwordEnv: 'RABBITMQ_DEFAULT_PASS',
  },
};

const IMAGE_ALIASES: Record<string, string> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  mysql: 'mysql',
  mariadb: 'mariadb',
  mongo: 'mongo',
  mongodb: 'mongo',
  redis: 'redis',
  minio: 'minio',
  rabbitmq: 'rabbitmq',
};

export function matchDatabaseTemplate(
  image: string,
): DatabaseTemplate | undefined {
  const base = image.split('/').pop()?.toLowerCase() ?? '';
  const kind = IMAGE_ALIASES[base];
  return kind ? DATABASE_TEMPLATES[kind] : undefined;
}
