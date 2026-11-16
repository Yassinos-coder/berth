# Installation

## Requirements

- A server running **Ubuntu, Debian, or Amazon Linux / RHEL** with root access.
- A public IP address.
- Enough room for the panel and your workloads. 2 GB of RAM is a comfortable minimum, because builds run on the server.
- Outbound internet access, to pull Docker images and clone repositories.

Docker is installed for you if it is missing.

## Open these ports

| Port | Used for |
| --- | --- |
| 3000 | The dashboard |
| 4443 | Agents connecting to the panel (only needed for additional servers) |
| 80, 443 | Your apps, once you add domains |
| 2022 | SFTP access to storage buckets, if you use them |

## Install the panel

```bash
curl -fsSL https://yassinos-coder.github.io/berth/install.sh | sudo bash
```

The script is safe to re-run. It will:

1. detect your operating system and install base packages
2. install Docker if needed
3. fetch Berth into `/opt/berth`
4. generate strong secrets and write the configuration to `/etc/berth`
5. build and start the panel (Postgres, Redis, the API and the dashboard)
6. install the Berth agent on this server and enroll it automatically

It takes a few minutes. A log is kept at `/var/log/berth-install.log`.

::: tip Read before you run
Piping a script into a root shell is a trust decision. You can read it first at [install.sh](https://yassinos-coder.github.io/berth/install.sh), or download it and run it yourself.
:::

## Create your admin account

When the installer finishes, it prints a URL. Open `http://<your-server-ip>:3000` and create the admin account. That account owns the panel.

## Add another server

Open **Servers → Add server** in the dashboard and copy the command it shows. Run it on the new server:

```bash
curl -fsSL https://yassinos-coder.github.io/berth/agent-install.sh | BERTH_BOOTSTRAP='...' BERTH_PANEL_URL='wss://panel.example.com:4443' sudo bash
```

The one-time token in the command expires quickly and works once. The agent exchanges it for a certificate, then keeps a secure connection open to your panel. If a token expires, use **Regenerate token** on the server.

## Update

```bash
sudo berth-update
```

Updates pull new images and restart the panel. Services you have deployed keep running during the update.

Back up your database before major upgrades, and upgrade the panel before the agents. See [Operations](/operations) and [Protocol versioning](/protocol-versioning).

## Troubleshooting

| Symptom | Try |
| --- | --- |
| The dashboard does not load | Check that port 3000 is open in your provider's firewall, then `docker ps` on the server. |
| A server stays "enrolling" | The token expired. Use **Regenerate token** and run the new command. |
| An agent keeps reconnecting | See [agent incident response](/operations#agent-incident-response). |
| The installer failed | Read `/var/log/berth-install.log`, fix the cause, and run the installer again. |
