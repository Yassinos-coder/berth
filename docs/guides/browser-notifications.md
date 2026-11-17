# Browser notifications

Berth can show a notification from your browser when:

- a build finishes and the service is live
- a deployment fails
- a service crashes

Notifications appear while the Berth tab is in the background or you are in another window. While you are looking at Berth, you already see the toast.

## Turn them on

The first time you open Berth, a banner asks whether you want notifications. Choose **Enable notifications**, then **Allow** in the prompt your browser shows. Berth reloads the page and they are on.

Choose **Not now** to hide the banner. You can turn them on later under **Settings → Notifications**, where you can also switch them off or send a test.

## If you blocked them

Browsers do not let a site ask again after you click Block. Allow notifications for the Berth address in your browser's site settings, then reload and turn them on in Settings.

## Notes

- This works in Chrome, Edge, Firefox and Safari. Berth must be opened over HTTPS, or on `localhost`, for the browser to allow notifications.
- Notifications are checked while a Berth tab is open. To be alerted when no tab is open, use a notification channel (email, Slack, webhook) under **Settings → Notifications**.
