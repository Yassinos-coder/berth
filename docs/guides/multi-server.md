# Several servers, one panel

One Berth panel can manage many servers, in different regions or at different providers. You install the panel once, then add each extra server with one command.

## How it works

- The panel runs on one server. Every other server runs only the **agent**.
- Agents **dial out** to the panel, so the extra servers need no open management port. The panel server needs **port 4443** reachable from them.
- The connection is mutually authenticated TLS. The "Add server" command carries a one-time token and the **fingerprint of your panel's certificate authority**. The new server downloads the CA, checks it against that fingerprint, and refuses to continue if it does not match, so a stranger cannot impersonate your panel.

## Add a server

1. Open **Servers → Add server**, give it a name, and copy the command.
2. Run it on the new server as root. It installs Docker if needed, builds the agent, verifies the panel, and enrolls.
3. The server shows as **online** in the panel within a minute.

The token is single use and expires quickly. If it expires, use **Regenerate token** on that server.

::: warning Set the panel's public address
The panel's certificate is issued for the address in `BERTH_PUBLIC_PANEL_URL`, which the installer sets to your server's public IP. If you later put the panel behind a domain, or the IP changes, update that setting and restart the panel, then regenerate tokens for new servers.
:::

## What each server does

Each server is independent. Services, their databases, their volumes, and the reverse proxy for their domains all live on the server you chose when creating the service. Point a domain's DNS at that server.

## Move a service to another server

Open the service, go to **Settings**, and use **Move to another server**. Only other servers that are online are offered. Berth checks that the new server has enough CPU, memory and storage budget, then starts the service there and removes it from the old one.

- **Domains.** Point the domain's DNS at the new server's IP address. Berth's proxy on the new server gets the certificate once DNS resolves.
- **Files do not move.** A service with persistent storage starts empty on the new server. Berth makes you confirm this first. To keep the data, back it up on the old server and restore it on the new one.
- **Interruption.** The service is stopped on the old server and started on the new one, so expect a short gap. Git services are built again on the new server.
- **Previews.** Preview environments cannot be moved on their own.

## Offline alerts

If a server stays offline for more than 2 minutes, Berth sends one alert to your notification channels ("alpha is offline"), and one more when it reconnects. A brief network blip does not alert. The alert is sent once per outage, even if the panel restarts.

Berth does not move services away from an offline server by itself. Services with files cannot be moved safely without your say-so, so moving is always a decision you make.

## What Berth does not do for you

- **No traffic routing between servers.** Berth does not send a visitor in Asia to the Asian server. Use DNS for that, such as geographic DNS or a load-balancing service in front of your servers.
- **No automatic failover.** If a server dies, its services do not move to another one.
- **No data replication.** A database lives on one server. Replicating it across regions is up to you.
- **Services reference each other only within a server.** Variable references to another service, and internal domains, resolve on the same server only.

## If the panel is down

Services keep running, because agents and containers do not depend on the panel. You cannot deploy or change anything until it is back. Back up the panel's database (see [Operations](/operations)).

## Tested

Several agents with different names enrolling and staying online at the same time against one panel, including a server whose agent is stopped and started again.
