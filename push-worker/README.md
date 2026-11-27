# Free four-hour meal-gap reminders

Fuel & Flow stays on GitHub Pages. A free Cloudflare Worker with a SQLite Durable Object holds a single alarm for each paired browser and sends standard Web Push. GitHub Pages alone cannot run an alarm while the app is closed. Use the **Workers Free** plan; no paid Workers add-ons are needed. [Cloudflare Free plan limits](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## One-time setup

1. In your Cloudflare account, open **Workers & Pages** and set up the free `workers.dev` subdomain if prompted. Stay on the Free plan. From a trusted computer with Node.js 22+, clone this repository and open the `push-worker` directory.
2. Run these commands from that directory. In the browser authorization screen, sign in to your Cloudflare account and review the Wrangler permissions.
   ```sh
   npx wrangler login
   node setup.mjs you@example.com
   ```
   Use a valid email address you control for the standard VAPID contact. This is a service-operator contact, not an app login. Setup uploads secrets directly to your Cloudflare Worker. It prints your pairing key locally and saves a private, git-ignored `.push-secrets.local.json`. Do not commit it or send its contents in chat. To deploy updates without invalidating subscriptions, reuse the same secrets: `npx wrangler deploy --secrets-file .push-secrets.local.json`.
3. On the Android device where you log meals, open Fuel & Flow → **More → Notifications** (also in Settings). Enter the deployed HTTPS `workers.dev` URL and the pairing key. Tap **Turn on notifications**, then allow browser notifications. On iPhone/iPad, open the installed Home Screen app first.
4. Confirm the status says **Reminders enabled**. To test delivery, use a test device or a throwaway app log whose first timed meal is just under four hours ago, then close the app. Do not add a fake meal to your actual diary to test push. **Turn off notifications** unsubscribes this browser and cancels the alarm; if offline, reopen online to finish server cleanup.

## Behavior and privacy

One reminder per last timed, logged meal. A newer logged meal reschedules it; an earlier meal edit, Undo, deletion, or closing today's food log cancels or recalculates it. No first-meal reminder, no replay beyond ten minutes after the threshold, no alerts before 6 AM or at/after 10 PM local time. OS notification settings and push-provider delivery apply. Edits made offline need to sync before the cloud alarm can change, and this does not sync edits between devices.

Requests are authenticated with a random pairing key. The server processes a random browser ID, HTTPS push address and alert time; it never receives names of foods, nutrition or the full diary. It drops the pending address after delivery, cancellation, or expiry. A short-lived sent marker avoids repeat delivery if you reopen the app. The private VAPID signing key stays in Cloudflare and your local secret backup. Do not host untrusted projects on the same GitHub Pages origin as this app.

## Update an existing Worker

The **Sync now** and **Test browser notification only** checks work with your existing Worker. **Send test push** also needs the updated Worker code. From the Fuel & Flow checkout you already used to deploy, run:

```sh
git pull --ff-only
cd push-worker
npx wrangler deploy
```

Use the same Cloudflare account and Worker name. Do not rerun the initial setup or rotate your pairing key. An ordinary deploy leaves the existing secrets and device pairing in place. Once the app and Worker are updated, tap **More → Notifications → Send test push**. The push provider accepting the test is not proof of delivery; look for the separately labeled test notification on the device. It does not change your next meal alert or diary.

If the test says **Could not reach the push provider** just after upgrading from the first test-push version, redeploy the current Worker. The earlier code used a redirect mode unsupported by Cloudflare; the current Worker does not follow provider redirects.

For development, run `workerd test push-worker/runtime-tests/config.capnp` from the repository root to check both kinds of push in the Workers runtime, using a fake push provider.
