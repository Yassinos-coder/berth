# Domains and HTTPS

Berth runs a managed Caddy reverse proxy on each server. It listens on ports 80 and 443 and forwards each domain to the right service.

## Add a domain

1. Create a DNS **A record** for the domain pointing at the server's public IP.
2. Open **Proxy hosts → Add** and choose the domain and the target service.
3. Berth checks DNS and warns if the record is missing or points elsewhere.
4. After the next reconcile, Caddy obtains a Let's Encrypt certificate and serves the domain over HTTPS.

## Options

- **Force HTTPS** redirects HTTP to HTTPS.
- **HTTP/2 and HTTP/3** are enabled.
- **Path routing** lets one domain serve several services, for example `/` for the site and `/api` for the backend.

## Requirements

- Ports 80 and 443 reachable from the internet (Let's Encrypt validates over them).
- DNS already pointing at the server before you add the host, or certificate issuance will fail until it does.

## Troubleshooting

See [Operations](/operations) for the proxy and TLS runbook.
