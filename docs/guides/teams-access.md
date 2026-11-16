# Teams and access

## Invite people

Open **Team**, choose **Invite**, enter an email address and pick a role. The invitation link lets them set a password.

## Roles

| Role | Typical use | Can |
| --- | --- | --- |
| owner | The person who runs the panel | Everything |
| admin | Trusted operators | Manage servers and members |
| deployer | Developers | Deploy, restart, change limits and variables |
| viewer | Stakeholders | Read services and logs |

Permissions are enforced on the server for every change, not only hidden in the interface.

## API tokens

Create personal tokens under **Settings → API tokens** for the CLI and automation. A token acts with your role. Revoke it any time.

## Audit log

Sensitive changes are recorded in the audit log.

## Sign-in security

Sessions use secure, HTTP-only cookies. Accounts can enable two-factor authentication, and repeated failed logins trigger slow-downs and temporary bans.
