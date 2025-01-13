/**
 * Pushover notification handler
 * Check Pushover API docs for more details: https://pushover.net/api
 *
 * @param env				Environment variable pass through
 * @param title 		Title of the notification message
 * @param message 	Body of the notification message
 * @param priority 	0 for normal, positive for highly sensitive, negative for quiet
 * @returns {Promise<Response>}
 */
export async function pushOver(env, title, message, priority) {
	let pushOverData = {
		'token': env.PO_APPTOKEN,
		'user': env.PO_USERKEY,
		'title': title,
		'message': message,
		'priority': priority
	};

	// Skip actually pushing notification if developing locally
	if (env.IS_LOCAL_DEV === 'local-dev') {
		console.log('Pushover Message generated: ' + JSON.stringify(pushOverData));
		return null;
	}

	let pushOverResults = await fetch('https://api.pushover.net/1/messages.json', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams(pushOverData)
	});

	let pushOverResultsBody = await pushOverResults.text();

	// Parse Pushover response
	let pushOverResultsParsed = JSON.parse(pushOverResultsBody);
	if (pushOverResultsParsed.status !== 1) {
		console.error('Pushover failed: ' + pushOverResultsParsed);
		return new Response(null, { status: 500 });
	}
}

/**
 * Convert seconds to human-readable format
 * Shamelessly stolen from https://stackoverflow.com/a/76163982/11296357
 *
 * @param x  Seconds in integer
 * @returns {string}
 */
export function secondHumanReadable(x) {
	let h = ~~(x / 3600),
		m = ~~((x - h * 3600) / 60),
		s = x - h * 3600 - m * 60;
	let words = ['hour', 'minute', 'second'];
	return [h, m, s]
		.map((x, i) => !x ? '' : `${x} ${words[i]}${x !== 1 ? 's' : ''}`)
		.filter(x => x)
		.join(', ')
		.replace(/,([^,]*)$/, ' and$1');
}
