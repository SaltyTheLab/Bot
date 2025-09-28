
const WEBHOOK_URLS = ["https://discord.com/api/webhooks/1421925716353614027/KIQ2Li6CiH1cIzcd7h4wSsbHzYNxF_Q8JR48WkOEGnqqgXJpgdOH9Ob7A31W5B1B6oKV",
    "https://discord.com/api/webhooks/1421926555524792340/r8w0MzITz_PqGhpkZfYND7UgZMc4nDjG6MAca4tQ7kgumJQby906B-5_R5EatpDcOGYI"
]
export async function sendShutdownWebHook(status) {
    let color;
    let title;
    let description;
    switch (status) {
        case "SHUTDOWN":
            color = 16711680;
            title = "🔴 System Shutdown";
            description = "The bot is shutting down and will be offline. This is a controlled action.";
            break;
        default:
            color = 16776960
            title = "🟡 System Restarting";
            description = "The bot is temporarily going offline to perform a controlled restart. Be back shortly!";
            break;
    }

    const payload = {
        username: "Febot Status",
        embeds: [{
            title: title,
            description: description,
            color: color,
            timestamp: new Date().toISOString()
        }]

    };
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)

    };
    const webhookPromises = WEBHOOK_URLS.map((url) => {
        return sendWebhookRequest(url, requestOptions, status);
    })

    const results = await Promise.allSettled(webhookPromises);

    let successCount = results.filter(r => r.status === 'fulfilled').length;
    let failureCount = results.length - successCount;

    console.log(`\n--- Webhook Summary ---`);
    console.log(`Attempted to send to ${WEBHOOK_URLS.length} servers.`);
    console.log(`Successes: ${successCount} | Failures: ${failureCount}`);
    console.log(`-------------------------\n`);
}

async function sendWebhookRequest(url, options, status) {
    try {
        const response = await fetch(url, options);

        if (response.ok) {
            console.log(`✅ Successfully sent ${status} webhook to ${url.substring(0, 50)}...`);
            return { status: 'success' };
        } else {
            const errorBody = await response.text();
            console.error(`❌ Webhook FAILED for ${url.substring(0, 50)}... Status: ${response.status}`);
            console.error(`   Discord Error: ${errorBody.length > 200 ? errorBody.substring(0, 200) + '...' : errorBody}`);
            return { status: 'failure', reason: `HTTP ${response.status}` };
        }
    } catch (err) {
        console.error(`❌ Network Error for ${url.substring(0, 50)}...: ${err.message}`);
        return { status: 'failure', reason: `Network Error: ${err.message}` };
    }
}
