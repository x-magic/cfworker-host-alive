## A Cloudflare Worker for monitoring host online status

This project uses Cloudflare Worker and D1 database to track if a given host has been online. Notifications will be sent over [Pushover](https://pushover.net).

### How it works?
The worker has two parts - host and worker.
- **For host**: this is the server you need to know if it's online or not. You'll need to set up a scheduled task on it to call the worker on a regular basis
- **For worker**: this is the code running in the cloud. It has a scheduler that checks all hosts stored in the database on the given frequency (by default every 3 minutes)

### To test and deploy
- Run `npm run dev` in your terminal to start a development server
- Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to trigger scheduled check-in
- Run `npm run deploy` to publish the worker

When deployed, ensure to:
- bind a D1 database in `wrangler.toml` and import schema/data in `database.sql`
- use `wrangler secret put PO_APPTOKEN` and `wrangler secret put PO_USERKEY` to set up Pushover credentials
- do NOT reuse the UUID hostkey in schema/data file, update them with your own. It's probably easier to do this via [Cloudflare dashboard](https://dash.cloudflare.com/)

For local development, schema/data can be imported by `wrangler d1 execute DATABASE_NAME --file database.sql --local`

On host-side, use a method of your choice (usually CRON) to call your worker, with "hostkey" argument, on a regular basis. The frequency should match the schedule of the worker, but a minute earlier than worker schedule.

For example:
`0-57/3 * * * * /usr/bin/curl -m 10 "https://worker_name.account_name.workers.dev/?hostkey=RANDOM_HOST_KEY_IN_DATABASE" >/dev/null 2>&1`

### What else?
Ensure you know that:
- Cloudflare worker free tier has limits. When monitoring too many hosts, you may easily hit the limit of both scheduler and CPU time
- D1 database has rate limit for free tier as well. You should be able to dial down the frequency to per minute if you're only monitoring one host
- Cloudflare KV, which is somehow based on D1, has a much tighter rate limit on free tier, and that's why KV is not being used here

And I only tested if it works when monitoring 1 host. Tell me about it :P
