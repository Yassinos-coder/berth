# GitHub deploys

## How it works

Berth registers its own GitHub App on your account through a one-click flow. When you push, GitHub sends a signed webhook to your panel. Berth verifies the signature, queues a deployment, and tells the agent to build and release it.

The agent clones the repository with a short-lived access token, builds the image, and starts it with a health-checked cutover.

## Build settings

By default Berth builds with your `Dockerfile`, or Nixpacks if none exists. Each service can override:

| Setting | Purpose |
| --- | --- |
| Root directory | Build a subfolder, useful for monorepos |
| Build command | Passed to Nixpacks as the build command |
| Start command | Passed to Nixpacks as the start command |
| Target platform | `linux/amd64` or `linux/arm64` |

## Live logs and progress

The build log streams as it runs. The deploy stepper shows **Clone, Build, Start, Health** so you can see where a failure happened. A failed deploy keeps the reason, with credentials removed.

## Rollback

Open **Deployments**, choose a previous successful deployment and roll back. From the CLI: `berth rollback <deploymentId>`.

Rollback rebuilds the **exact commit** of that deployment. If the commit can no longer be fetched, the deploy fails and the running version keeps serving. The next push, or a manual redeploy, goes back to the branch head.

## Pull request previews

Turn on previews for a service and every pull request from the same repository gets a temporary copy. The copy is deleted when the pull request closes. Pull requests from forks are ignored. The GitHub App must be subscribed to the pull request event.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Pushes do not deploy | The GitHub App is installed on the repository, and the webhook shows recent deliveries without errors. |
| Build fails | Read the build log. Try the same build locally with Docker or Nixpacks. |
| Container never becomes healthy | Confirm the port matches the one your app listens on, and that the health check path returns success. |
