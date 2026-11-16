# Concepts

## Panel and agent

The **panel** is the control plane: dashboard, API, and a Postgres database holding everything you have configured. The **agent** runs on each server, talks to Docker, and manages that server's reverse proxy.

Agents connect **out** to the panel and keep a long-lived, mutually authenticated TLS WebSocket open. That means a server behind NAT or a changing IP address still works, and you open no inbound ports for management.

## Desired state

You never tell Berth to "start this container". Instead you describe what should exist, and the panel sends that **desired state** to the agent. The agent compares it with what is actually running and fixes any difference.

This has useful consequences:

- Applying the same state twice changes nothing.
- A server that reboots, or an agent that reconnects, catches up on its own.
- A failed step is reported and retried rather than leaving things half done.

The guarantees are listed in [Reliability](/reliability).

## Services

Everything you deploy is a **service**, described by the same specification: where it comes from (a Git repository or an image), its environment, ports, volumes, resource limits, health check and replica count.

The "Deploy" menu is only a set of shortcuts that fill that specification in:

| You choose | You get |
| --- | --- |
| GitHub repository | A Git source with build settings and push-to-deploy |
| Docker image | An image source |
| Database | An image, a volume, and generated credentials |
| Bucket | S3-compatible storage with a volume |
| Template | A pre-filled service, sometimes several |
| Empty service | A blank specification |

## Environments

Environments group services, for example production and staging. Pull request previews are created in the environment flagged as preview.

## Your containers stay yours

The agent only manages containers it created, marked with Berth labels. It never touches other containers on the server.

## Roles

| Role | Can |
| --- | --- |
| owner | Everything, including billing and deleting the organization |
| admin | Manage servers and members |
| deployer | Deploy, restart, and change limits |
| viewer | Read and view logs |

## Going deeper

- [Architecture](/architecture) for the full design
- [Security lifecycle](/security-lifecycle) for how identity and secrets are handled
