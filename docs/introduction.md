# What is Berth

Berth turns a plain VPS into a deployment platform. You install a small panel on your own server, connect GitHub, and deploy apps, databases and services from a web dashboard, with the workflow you would expect from a hosted platform.

Nothing leaves your infrastructure. Berth has no hosted control plane, no license server and no telemetry. If you stop using it, your containers keep running.

## What you can do

- **Deploy from GitHub.** Pushes build and release automatically, with live build logs, rollback, and optional preview environments for pull requests.
- **Deploy any image.** Run a Docker image from any registry, with private registry credentials.
- **Create databases from templates.** Postgres, Redis and MySQL with generated credentials, plus S3-compatible storage with optional SFTP access.
- **Serve on your own domains.** Berth manages a reverse proxy with automatic HTTPS.
- **Control resources.** Limit CPU and memory per service, run several replicas, and let Berth scale them within the server's capacity.
- **Manage several servers.** One panel can manage many of your servers.
- **Work as a team.** Invite people with role-based access.
- **Script it.** A CLI and an MCP server expose the same operations to your terminal and to AI assistants.

## How it is built

Two pieces do the work:

- The **panel** (API, dashboard and database) runs in Docker containers.
- The **agent** is a small native program that runs on each server. It owns Docker, resource limits and the reverse proxy.

The panel never touches a server directly. It records what you want, and each agent makes its server match. [Concepts](/concepts) explains this in more detail, and [Architecture](/architecture) has the full design.

## Who it is for

Berth fits developers and small teams who already rent servers (OVH, Hetzner, DigitalOcean, or any Linux box) and want a good deploy experience without paying a platform premium or giving up control.

It is not a hosted SaaS, a Kubernetes replacement, or a serverless runtime. See [the v1 roadmap](/roadmap-v1) for what is in and out of scope.

## Next steps

1. [Install the panel](/installation)
2. [Deploy your first app](/first-deploy)
