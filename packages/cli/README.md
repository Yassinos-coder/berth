# @berth/cli

Manage a Berth panel from the terminal, and expose it to AI assistants over MCP.

## Setup

Create a personal API token in the panel (Settings → API tokens), then:

```sh
berth login --url https://panel.example.com --token berth_...
```

The login is stored in `~/.config/berth/config.json` (mode 600). `BERTH_URL` and `BERTH_TOKEN` override it.

## Commands

| Command | What it does |
| --- | --- |
| `berth ls` | List services |
| `berth deploy <service>` | Rebuild and redeploy |
| `berth restart\|start\|stop <service>` | Control a service |
| `berth logs <service> [-b] [-n 200] [-f]` | Runtime logs, `-b` for the latest build, `-f` to follow |
| `berth deployments [service]` | Recent deployments |
| `berth rollback <deploymentId>` | Roll back |
| `berth env get\|set\|unset <service> ...` | Variables (`--reveal`, `--secret`) |
| `berth shell <service>` | Interactive shell in the container |
| `berth mcp` | MCP server over stdio |

`<service>` accepts a name, an id, or any unambiguous prefix.

## MCP

```json
{
  "mcpServers": {
    "berth": { "command": "berth", "args": ["mcp"] }
  }
}
```

Tools: `list_services`, `get_logs`, `list_deployments`, `get_env` (secrets masked), `restart_service`, `redeploy_service`, `start_service`, `stop_service`, `rollback_deployment`. Variables cannot be written through MCP. The token's panel role applies to every call.
