# Deploy your first app

This walks the shortest path from a fresh panel to an app running on your own domain with HTTPS.

## 1. Check your server

Open **Servers**. The server the installer enrolled should show as **online**. If it does not, see [Troubleshooting](/installation#troubleshooting).

## 2. Connect GitHub

Go to **Settings** and choose **Create GitHub App**. Berth registers a GitHub App for your panel and stores its keys encrypted. Install the app on the account or organization that owns your repository.

::: info
Berth uses its own GitHub App, so no third party sees your code or tokens.
:::

## 3. Create the service

Choose **Deploy**, then **GitHub repository**. Pick the repository and branch. If the repo has a `Dockerfile`, Berth uses it. Otherwise Berth builds with Nixpacks.

Set the port your app listens on, add environment variables, and optionally set CPU and memory limits. Defaults are conservative so one service cannot starve the server.

## 4. Watch it build

The service page streams the build log and shows progress through **Clone, Build, Start, Health**. A deploy only replaces the running container after the new one passes its health check, so a broken build leaves the old version serving.

## 5. Add a domain

Create an **A record** for your domain pointing at the server's IP, then open **Proxy hosts** and add the domain, choosing your service. Berth checks DNS first and tells you if the record does not point at the server yet.

Once DNS is correct, Berth requests a Let's Encrypt certificate automatically. Ports 80 and 443 must be reachable for this.

## 6. Ship changes

Push to the branch. The webhook queues a deployment and the new version rolls out. If something goes wrong, open **Deployments** and roll back to a previous version.

## What to read next

- [GitHub deploys](/guides/github-deploys) for build settings, monorepos and previews
- [Domains and HTTPS](/guides/domains-https)
- [Databases and templates](/guides/databases-templates)
- [Scaling](/scaling)
