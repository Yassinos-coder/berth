---
layout: home

hero:
  name: Berth
  text: Deploy to servers you own
  tagline: A self-hosted deployment panel for your own VPS. The convenience of Railway or Render, on infrastructure you control.
  actions:
    - theme: brand
      text: Get started
      link: /installation
    - theme: alt
      text: How it works
      link: /concepts
    - theme: alt
      text: View on GitHub
      link: https://github.com/Yassinos-coder/berth

features:
  - title: Push to deploy
    details: Connect GitHub and every push builds and ships. Berth uses your Dockerfile, or Nixpacks when there isn't one, and streams the build log live.
  - title: Databases and services in a click
    details: Postgres, Redis, MySQL and S3-compatible storage come from templates. Run any Docker image too.
  - title: Automatic HTTPS
    details: Point a domain at a service. Berth runs Caddy for you and handles Let's Encrypt certificates.
  - title: One panel, many servers
    details: Add another VPS with a single command. Agents dial out to the panel, so there are no inbound ports to open.
  - title: Limits and teams
    details: Set CPU and memory per service, and invite teammates as owner, admin, deployer or viewer.
  - title: Yours
    details: Everything runs on your hardware. No phone-home and no license server.
---

## Install in one command

On a fresh Ubuntu, Debian or Amazon Linux server:

```bash
curl -fsSL https://yassinos-coder.github.io/berth/install.sh | sudo bash
```

Then open `http://<your-server-ip>:3000`, create your admin account, and deploy. The [installation guide](/installation) covers requirements, what the script does, and how to update.

::: warning Alpha
Berth is in alpha. The core deploy loop works on real servers, and the current work is hardening. Read [the roadmap](/roadmap-v1) before relying on it for production.
:::
