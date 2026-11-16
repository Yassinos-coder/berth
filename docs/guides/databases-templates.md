# Databases and templates

## Databases

Choose **Deploy → Database** and pick Postgres, Redis or MySQL. Berth creates the container with a persistent volume and generates credentials. The connection details appear on the service page.

Other services on the same server reach it by name over the private Berth network, so the database does not need a public port.

## Referencing one service from another

A variable can read another service's value:

```text
DATABASE_URL=postgres://user:pass@${{my-db.HOST}}:${{my-db.PORT}}/app
```

Three forms are supported for services on the same server:

```text
${{service-name.VARIABLE}}
${{service-name.HOST}}
${{service-name.PORT}}
```

Unknown references are left as written, so a typo is easy to spot. Changing the referenced value redeploys dependent services on the next reconcile.

## Storage buckets

**Deploy → Bucket** creates S3-compatible storage backed by a volume. Berth also exposes each bucket over **SFTP on port 2022**, using the bucket's access key and secret as the login.

::: warning
The bucket image is a frozen build with no security updates. Keep buckets private and treat them as a stopgap until a maintained S3 server replaces it.
:::

## Templates

Templates are ready-made services such as common apps. They are pre-filled service definitions, so you can change anything after creating them.

## Backups

Database backups can be created from the panel. Test a restore before you need one. The steps are in [Operations](/operations#backup-and-restore).

## Volumes

Any service can have a persistent volume. Clearing the mount path unmounts it but keeps the data.
