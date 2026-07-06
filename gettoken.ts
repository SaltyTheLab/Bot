import { ws } from './Database';

const code = process.argv[2];
if (!code) {
    console.error('Usage: bun run get-token.ts <code>');
    process.exit(1);
}

const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        client_id: Bun.env.TWITCH_ID!,
        client_secret: Bun.env.TWITCH_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:3000',
    }),
});
const tokens = await res.json() as any;
if (!tokens.access_token) {
    console.error('Token exchange failed:', tokens);
    process.exit(1);
}

const meRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: { 'Client-ID': Bun.env.TWITCH_ID!, 'Authorization': `Bearer ${tokens.access_token}` },
});
const me = await meRes.json() as any;
const botId = me.data[0].id;

await ws.updateOne({}, {
    $set: {
        twitchbot: botId,
        twitchaccess: tokens.access_token,
        twitchrefresh: tokens.refresh_token,
        twitchexpires: tokens.expires_in,
        twitchobtained: Date.now(),
    }
}, { upsert: true });

console.log(`Bot ID: ${botId} — tokens saved to db.`);
process.exit(0);