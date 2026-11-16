# CLI and MCP

The `berth` command-line tool manages a panel from your terminal and exposes it to AI assistants.

## Set up

Create a token under **Settings → API tokens**, then:

```bash
berth login --url https://panel.example.com --token berth_...
```

The login is stored in `~/.config/berth/config.json` with owner-only permissions. `BERTH_URL` and `BERTH_TOKEN` override it.

## Commands

| Command | What it does |
| --- | --- |
| `berth ls` | List services |
| `berth deploy <service>` | Rebuild and redeploy |
| `berth restart`, `start`, `stop <service>` | Control a service |
| `berth logs <service> [-b] [-n 200] [-f]` | Runtime logs. `-b` shows the latest build, `-f` follows |
| `berth deployments [service]` | Recent deployments |
| `berth rollback <deploymentId>` | Roll back |
| `berth env get`, `set`, `unset <service> ...` | Manage variables |
| `berth shell <service>` | Open a shell in the container |
| `berth mcp` | Start an MCP server over stdio |

`<service>` accepts a name, an id, or any unambiguous prefix.

## MCP

Add Berth to an MCP-capable assistant:

```json
{
  "mcpServers": {
    "berth": { "command": "berth", "args": ["mcp"] }
  }
}
```
