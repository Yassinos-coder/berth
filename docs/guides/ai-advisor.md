# AI advisor

The advisor reviews how your services and servers are really behaving and suggests safe improvements. You decide whether to apply each one.

## What it suggests

- Memory that is too small, or far larger than a service ever uses, based on the last 7 days of usage
- A disk that is nearly full, or a server whose storage budget is overcommitted
- Missing safety nets, such as automatic rollback on a service that deploys often
- Anything else the model notices in your configuration

Built-in checks always run for free. If you add an AI provider, its suggestions are added on top.

## Turn it on

During first-run setup there is an optional **AI advisor** step, and you can set it up later under **Settings → Resources**.

1. Switch it on and pick a **provider**. Berth lists the common ones, plus **Custom (OpenAI-compatible)** and local **Ollama**.
2. For a known provider the API URL is fixed and cannot be changed. For a custom provider you enter your own URL.
3. Pick a **model** and paste your **API key**.
4. Set a **monthly spending cap**. The default is $5.

Berth stops calling the provider before the cap would be exceeded. The built-in checks keep working.

## Apply or decline

When there is something to suggest, a badge with the count appears next to the theme toggle in the header. It opens the advisor page.

Each suggestion shows why, the evidence, and exactly what would change, for example `memory 512 MB → 1536 MB`.

- **Apply** makes the change right away, with the same checks as editing the service yourself. Owners, admins and deployers can apply.
- **Decline** hides it. It will not come back unless the situation changes.
- **Undo** puts the previous values back after you applied a change.

Every applied change is recorded in the activity feed.

## Privacy

| Sent to the provider | Never sent |
| --- | --- |
| Service and server names, sizes and counts | Environment variables and secrets |
| CPU and memory peaks and averages | Registry credentials and API tokens |
| Deploy success and failure counts | Repository URLs and commit messages |
| Whether HTTPS is on for a domain | Logs and file contents |

Your API key is encrypted before it is stored and is never sent back to the browser. The advisor only uses an allowlist of fields, so new secrets added later are not included by accident.

Suggestions from the model can only be one of three actions: change CPU or memory, change disk size, or turn on automatic rollback. Anything else is ignored.

## Cost

A typical analysis is a few thousand tokens, so a daily run usually costs well under a cent with small models. The advisor page shows what you spent this month against your cap. **Analyze now** runs one on demand, at most every five minutes.
