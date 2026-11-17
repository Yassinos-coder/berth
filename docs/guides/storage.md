# Storage

Berth gives every service that keeps files a **hard size limit**, and lets you decide how much of each server's disk Berth may use in total.

## Does my service need storage?

| You are deploying | Persistent storage |
| --- | --- |
| A backend API or website (stateless) | **No.** Keep data in a database or object storage. The image and build cache are not part of this. |
| An app that writes files that must survive a redeploy (uploads, SQLite) | Yes. Turn it on and pick a size. |
| A database | **Yes, always.** Defaults: 5 GB for Postgres and MySQL, 1 GB for Redis. Size it for your data plus room to grow. |
| An S3-compatible bucket | **Yes, always.** Default 10 GB. |

You choose the size when you create the service, and you can change it later.

## The Berth budget

When you create your admin account, Berth shows your server's disk and asks how much it may use, for example 25 of 100 GB. Every service's storage is carved out of that budget. You can change it later under **Servers**.

A share of the budget (about 15 percent, at least 2 GB) is **reserved** for container images, build cache and logs. The rest is what you can give to services. If you give a service more than is free, Berth tells you how much is available.

Servers you add later start with no budget. Set one on the server's page; until then Berth does not limit disk use on that server.

## How the limit is enforced

Each limited volume is a fixed-size file formatted as ext4 and mounted on the server. A service **cannot write past its size**: the write fails with "No space left on device". This is tested against real Linux on every change.

Things you should know:

- The mount point is made immutable while empty. If the mount is ever missing, a container cannot write into it and fill the server's disk. It fails instead.
- The volume is mounted at boot through `/etc/fstab` with `nofail`, so a problem with one volume never stops the server from booting. Berth keeps a backup of the original at `/etc/fstab.berth.bak`.
- It needs Linux, root, and the `e2fsprogs` and `util-linux` packages. The installers add them.

## Changing a size

Open the service, go to **Settings**, and change **Storage size**. No need to delete anything.

- **Growing** keeps your data. The service restarts briefly.
- **Shrinking** works only if your data fits in the new size. If it does not, the deploy fails and the service keeps running as before.

## Seeing how full it is

A service with a size limit shows a usage bar at the top of its **Storage size** settings, for example `1.2 GB used of 5 GB`. The agent reports it about once a minute, so a brand-new volume shows nothing until the first reading.

The bar turns amber at 80 percent and red at 90 percent. At 90 percent Berth also sends an alert to your notification channels, at most once every 6 hours per service. A full volume makes writes fail, so grow it from the same card before that happens. Growing keeps your data.

Volumes without a limit (older ones) are not measured. Enforce a limit to start tracking them.

## Older volumes

Volumes created before limits existed have no size limit. Their Settings page says so, and offers **Enforce limit**. Berth copies the data into a new limited volume and switches the service to it, which needs a short restart. **Your original volume is kept untouched as a backup.** Delete it yourself when you are happy, to free the space.

## What the budget does not do

- Images and build cache cannot be given a hard limit by a quota on an ordinary server, so they share the reserve. Berth keeps them in check but does not wall them off.
- The budget limits what you can *allocate*. It does not yet show how full each volume is.
