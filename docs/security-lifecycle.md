# Security lifecycle

How identity and secrets are issued, used, rotated and revoked. Each section states what Berth does today and what is still open.

## Agent identity (mTLS)

| Stage | Today |
| --- | --- |
| Issue | Panel CA signs the agent CSR once, after a single-use bootstrap token (short TTL, burned on use). The certificate serial is stored on the `Server` row. |
| Use | The agent dials `/agent` over mTLS. The gateway checks the client certificate against the CA, then checks the server record (see Revocation). |
| Lifetime | Client certificates are valid for 1 year and renew automatically (below). |
| Revoke | Immediate and server-side, no CRL needed (below). |
| Recover | Regenerate the server token in the UI, re-run the agent installer. The installer replaces a stale certificate. |

### Revocation

The gateway refuses an agent when any of these hold:

- the server record no longer exists (server deleted)
- a bootstrap token is pending for the server (**Regenerate token** was used, so the previous certificate is dead until the agent re-enrolls)
- the certificate serial differs from the one recorded at the last enrollment (a newer certificate superseded it)
- the database cannot be read (fail closed)

Servers enrolled before serials were recorded (no stored serial) are accepted until they re-enroll.

### Renewal

On every connection the panel looks at the certificate the agent presented. If it expires within 120 days, or it is a legacy certificate issued for more than about 18 months, the panel sends `RenewCertificate`. The agent then:

1. generates a new key pair and keeps the private key in `<client key>.pending`
2. sends a CSR over the live, already authenticated connection
3. receives the signed certificate and swaps key and certificate into place

The panel records the new serial as pending. **Both the old and the new certificate are accepted** until the new one is actually used to connect, at which point it becomes the current serial. If the agent fails to install the new certificate, the old one keeps working.

An agent that stays offline for longer than the remaining lifetime cannot renew. Re-enroll it with **Regenerate token**.

### Open items

- Panel CA rotation procedure (the CA is valid for years and its key is encrypted with `BERTH_MASTER_KEY`).
- A narrow window exists while the agent swaps key and certificate files; a crash exactly then requires re-enrollment.

## Secrets at rest

- Service environment secrets, registry credentials and GitHub App material are encrypted with AES-256-GCM (`SecretCipher`), keyed from `BERTH_MASTER_KEY`.
- Decryption happens in the panel process only, when building a reconcile payload or calling an upstream. Secrets are sent to the agent over the mTLS channel and are not written to the agent's disk except as container environment.
- Mutations of sensitive resources are written to the audit log.

### Rotation

| Secret | How |
| --- | --- |
| `JWT_SECRET` | Change the value and restart the panel. All sessions end. |
| `BERTH_MASTER_KEY` | Zero-downtime rotation, see below. |
| GitHub App key / webhook secret | Regenerate in GitHub, then update it in Settings. |
| Agent certificate | Regenerate the server token and re-enroll. |
| Database password | Update Postgres and `DATABASE_URL` together, then restart the panel. |

### Rotating the master key

Encrypted values carry the id of the key that wrote them (`v2:<key id>:…`), and the panel can hold several keys at once.

1. Take a database backup.
2. Generate a new key. Set `BERTH_MASTER_KEY` to it and `BERTH_MASTER_KEY_PREVIOUS` to the old one (comma-separated for more than one). Restart the panel. Everything still decrypts.
3. Re-encrypt stored secrets under the new key:

   ```bash
   bun --filter @berth/server secrets:rotate -- --dry-run   # preview
   bun --filter @berth/server secrets:rotate
   ```

   The script covers TOTP secrets, GitHub App secrets, SMTP passwords, registry and source credentials, backup target keys, secret environment variables, and the panel CA key file. It is idempotent.
4. Take a fresh backup, then remove `BERTH_MASTER_KEY_PREVIOUS` and restart.

If a value was written with a key that is neither current nor previous, the panel reports `unknown master key <id>` instead of returning garbage.

### Recovery testing

Restore a database backup into a scratch instance with the same `BERTH_MASTER_KEY` and confirm the panel boots and a service's secrets decrypt. Do this before every major upgrade. Without the key, a backup cannot be used.

## Review checklist for every reconcile path

Anything that changes what the agent does to the host must pass this before merge:

1. **Scope.** The agent only touches containers carrying `berth.service_id`. A new code path never acts on unlabeled containers.
2. **Input validation.** All fields from the panel are validated agent-side (`validators.rs`), not only panel-side: names, ports, volume paths, replica counts, resource ranges.
3. **No shell interpolation.** Arguments are passed as argv items, never concatenated into a shell string.
4. **Idempotent.** Applying the same spec twice is a no-op. A change that must not force a redeploy is excluded from the spec hash and has a test.
5. **Failure is reported.** A failed step becomes a `FailedApply` with a redacted reason. It never panics, and never silently continues.
6. **Secrets stay out of logs.** Credentials in clone URLs and env values are redacted before reaching build logs.
7. **Bounded.** Resource use, message sizes and replica counts have upper limits.
8. **Revocation-safe.** Nothing caches an identity beyond the connection.
9. **Protocol.** A change to the wire format follows `protocol-versioning.md`.

## Incident playbooks

Operational steps for a compromised agent, stale certificate, GitHub App misconfiguration and database restore are in [operations.md](operations.md). For a **compromised agent**:

1. Delete the server in the panel (or regenerate its token). The old certificate is refused immediately.
2. Rotate every secret that service specs on that server carried.
3. Rebuild the host from a clean image before re-enrolling.
