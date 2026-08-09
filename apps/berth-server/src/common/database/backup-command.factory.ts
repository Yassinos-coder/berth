const SUPPORTED_KINDS = new Set(['postgres', 'mysql', 'mariadb', 'mongo']);

function shEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export class BackupCommandFactory {
  static supports(templateKind: string | undefined | null): boolean {
    return Boolean(templateKind) && SUPPORTED_KINDS.has(templateKind!);
  }

  static dumpCommand(
    templateKind: string,
    env: Record<string, string>,
  ): string {
    switch (templateKind) {
      case 'postgres':
        return (
          `PGPASSWORD=${shEscape(env.POSTGRES_PASSWORD ?? '')} ` +
          `pg_dump -U ${shEscape(env.POSTGRES_USER ?? '')} ${shEscape(env.POSTGRES_DB ?? '')} | gzip`
        );
      case 'mysql':
        return (
          `mysqldump -u${shEscape(env.MYSQL_USER ?? '')} -p${shEscape(env.MYSQL_PASSWORD ?? '')} ` +
          `${shEscape(env.MYSQL_DATABASE ?? '')} | gzip`
        );
      case 'mariadb':
        return (
          `mysqldump -u${shEscape(env.MARIADB_USER ?? '')} -p${shEscape(env.MARIADB_PASSWORD ?? '')} ` +
          `${shEscape(env.MARIADB_DATABASE ?? '')} | gzip`
        );
      case 'mongo':
        return (
          `mongodump --username ${shEscape(env.MONGO_INITDB_ROOT_USERNAME ?? '')} ` +
          `--password ${shEscape(env.MONGO_INITDB_ROOT_PASSWORD ?? '')} --authenticationDatabase admin --archive | gzip`
        );
      default:
        throw new Error(`Unsupported template kind for backup: ${templateKind}`);
    }
  }

  static restoreCommand(
    templateKind: string,
    env: Record<string, string>,
  ): string {
    switch (templateKind) {
      case 'postgres':
        return (
          `gunzip | PGPASSWORD=${shEscape(env.POSTGRES_PASSWORD ?? '')} ` +
          `psql -U ${shEscape(env.POSTGRES_USER ?? '')} ${shEscape(env.POSTGRES_DB ?? '')}`
        );
      case 'mysql':
        return (
          `gunzip | mysql -u${shEscape(env.MYSQL_USER ?? '')} -p${shEscape(env.MYSQL_PASSWORD ?? '')} ` +
          `${shEscape(env.MYSQL_DATABASE ?? '')}`
        );
      case 'mariadb':
        return (
          `gunzip | mysql -u${shEscape(env.MARIADB_USER ?? '')} -p${shEscape(env.MARIADB_PASSWORD ?? '')} ` +
          `${shEscape(env.MARIADB_DATABASE ?? '')}`
        );
      case 'mongo':
        return (
          `gunzip | mongorestore --username ${shEscape(env.MONGO_INITDB_ROOT_USERNAME ?? '')} ` +
          `--password ${shEscape(env.MONGO_INITDB_ROOT_PASSWORD ?? '')} --authenticationDatabase admin --archive --drop`
        );
      default:
        throw new Error(`Unsupported template kind for restore: ${templateKind}`);
    }
  }
}
