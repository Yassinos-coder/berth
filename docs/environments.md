# Environments

| | Development | Staging | Production |
| --- | --- | --- | --- |
| Run with | `bun run dev:server`, `bun run dev:ui`, Postgres + Redis from `docker-compose.yml` | `docker-compose.prod.yml` on a scratch VPS | `install.sh` on the customer VPS |
| `NODE_ENV` | `development` | `production` | `production` |
| Secrets | `.env` with `dev-only` placeholders allowed | Real generated secrets | Real generated secrets (`install.sh` generates them) |
| `REDIS_URL` | optional, falls back to in-process | required | required |
| Database | local container | separate instance | separate instance |

## Enforced at boot

With `NODE_ENV=production` the panel refuses to start when `JWT_SECRET` or `BERTH_MASTER_KEY` is missing or contains `dev-only`.

## Rules

- Never reuse a production `BERTH_MASTER_KEY` or database in staging.
- Staging should run the same images as production. Promote an image, do not rebuild it.
- Before a production upgrade, take a database backup and rehearse it in staging (see [security-lifecycle.md](security-lifecycle.md#recovery-testing)).
