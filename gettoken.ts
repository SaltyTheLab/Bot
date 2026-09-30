import { ws } from './Database'
import { RefreshingAuthProvider } from '@twurple/auth'
const code = process.argv[2]
if (!code) {
    const url = new URL('https://id.twitch.tv/oauth2/authorize')
    url.search = new URLSearchParams({ client_id: Bun.env.TWITCH_ID!, redirect_uri: 'http://localhost:3000', response_type: 'code', scope: 'chat:read', }).toString()
    console.log(`Missing code. Log in as the BOT account and open:\n${url}\nThen run: bun get-token.ts <code from the redirect URL>`)
    process.exit(1)
}
const provider = new RefreshingAuthProvider({ clientId: Bun.env.TWITCH_ID!, clientSecret: Bun.env.TWITCH_SECRET!, redirectUri: 'http://localhost:3000', })
const userId = await provider.addUserForCode(code, ['chat'])
const token = await provider.getAccessTokenForUser(userId)

await ws.updateOne({}, {
    $set: {
        twitchaccess: token!.accessToken,
        twitchrefresh: token!.refreshToken,
        twitchexpires: token!.expiresIn,
        twitchobtained: token!.obtainmentTimestamp,
    }
}, { upsert: true })

console.log(`Saved tokens for ${token?.userId}.`)
process.exit(0)