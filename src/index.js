/**
 * A Cloudflare Worker for monitoring host online status
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to trigger scheduled check-in
 * - Run `npm run deploy` to publish the worker
 *
 * When deployed, ensure to:
 * - bind a D1 database in `wrangler.toml` and import schema/data in `database.sql`
 * - use `wrangler secret put PO_APPTOKEN` and `wrangler secret put PO_USERKEY` to set up Pushover credentials
 *
 * For local development, schema/data can be imported by `wrangler d1 execute DATABASE_NAME --file database.sql --local`
 *
 * On host-side, use a method of your choice (usually CRON) to call:
 * > https://worker_name.account_name.workers.dev/?hostkey=RANDOM_HOST_KEY_IN_DATABASE
 * on a regular basis. The frequency should match the schedule of the worker, but a minute earlier than worker schedule.
 *
 * For example:
 * `0-57/3 * * * * /usr/bin/curl -m 10 "https://worker_name.account_name.workers.dev/?hostkey=RANDOM_HOST_KEY_IN_DATABASE" >/dev/null 2>&1`
 */

import { pushOver, secondHumanReadable } from './misc.js';

export default {
	// When hosts are pinging service worker (Host report it's alive)
	async fetch(request, env, ctx) {
		// Get data from request
		const request_url = new URL(request.url);
		const hostKey = request_url.searchParams.get('hostkey');

		// Ensure host key is provided in the request
		if (!hostKey)
			return new Response(null, { status: 400 });

		let currentTime = Math.floor(Date.now() / 1000);

		// Write last checkin timestamp to D1
		const resultWriteHostData = await env.MONITORED_HOSTS_DB
			.prepare('UPDATE [hosts] SET lastcheckin = ? WHERE hostkey = ?')
			.bind(currentTime, hostKey)
			.run();
		if (!resultWriteHostData.success) {
			console.error('D1 database failed to write updates' + JSON.stringify(resultWriteHostData));
			return new Response(null, { status: 500 });
		}

		return new Response(null, { status: 200 });
	},

	// When service worker is triggered by CRON (Service worker check if there's any disconnected hosts)
	async scheduled(event, env, ctx) {
		const timeOfSchedule = new Date(event.scheduledTime).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });

		// Threshold (which should be set depends on how often CRON job is triggered)
		const disconnectionThreshold = await env.DISCONNECTION_THRESHOLD || 75;
		const reconnectionThreshold = await env.RECONNECTION_THRESHOLD || 60;

		// Go through all host configurations in D1
		const resultReadHostsData = await env.MONITORED_HOSTS_DB
			.prepare('SELECT * FROM [hosts]')
			.run();
		if (!resultReadHostsData.success) {
			console.error('D1 failed to retrieve hosts data: ' + JSON.stringify(resultReadHostsData));
			return;
		}

		for (const currentHost of resultReadHostsData.results) {
			let currentTime = Math.floor(Date.now() / 1000);
			let checkinTimeDifference = currentTime - currentHost.lastcheckin;

			// Check if the current host was previously detected as disconnected
			if (currentHost.disconnected) {
				if (checkinTimeDifference <= reconnectionThreshold) {
					// Previously disconnected host has been reconnected

					// Save changes back to database
					const resultWriteHostData = await env.MONITORED_HOSTS_DB
						.prepare('UPDATE [hosts] SET disconnected = ? WHERE hostkey = ?')
						.bind(false, currentHost.hostkey)
						.run();
					if (!resultWriteHostData.success) {
						console.error('D1 database failed to write updates: ' + JSON.stringify(resultWriteHostData));
						break;
					}

					// And notify on reconnection
					console.log(`${timeOfSchedule}: Checked '${currentHost.hostname}', and it has recovered from disconnection after ${checkinTimeDifference}s.`);
					await pushOver(
						env,
						`${currentHost.hostname} is back online!`,  // title
						`${currentHost.hostname} is back online. It was offline for ${secondHumanReadable(checkinTimeDifference)}`,  // message
						0  // priority
					);
				} else {
					console.log(`${timeOfSchedule}: Checked '${currentHost.hostname}', which is known to be offline. Time since last check-in: ${checkinTimeDifference}s.`);
				}
			} else {
				if (checkinTimeDifference >= disconnectionThreshold) {
					// Host has missed a checkpoint and is considered as disconnected

					// Save changes back to database
					const resultWriteHostData = await env.MONITORED_HOSTS_DB
						.prepare('UPDATE [hosts] SET disconnected = ? WHERE hostkey = ?')
						.bind(true, currentHost.hostkey)
						.run();
					if (!resultWriteHostData.success) {
						console.error('D1 database failed to write updates: ' + JSON.stringify(resultWriteHostData));
						break;
					}

					// And notify on reconnection
					console.log(`${timeOfSchedule}: Checked '${currentHost.hostname}', and it seems to be offline.`);
					await pushOver(
						env,
						`${currentHost.hostname} is offline!`,  // title
						`${currentHost.hostname} seems to be offline.\nLast check-in: ${new Date(currentHost.lastcheckin * 1000).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })}`,  // message
						0  // priority
					);
				} else {
					console.log(`${timeOfSchedule}: Checked '${currentHost.hostname}'. Time since last check-in: ${checkinTimeDifference}s.`);
				}
			}
		}
	}
};
