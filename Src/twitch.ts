import { env } from 'bun';
import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { twitchconfig } from './Database';
const authProvider = new RefreshingAuthProvider({ clientId: env.TWITCH_ID!, clientSecret: env.TWITCH_SECRET! });
const doc = await twitchconfig.findOne({}, { projection: { twitchuserid: 1, twitchaccess: 1, twitchrefresh: 1, twitchexpires: 1, twitchobtained: 1 } }) as any;
if (!doc?.twitchuserid || !doc?.twitchaccess) {
    console.info('[twitch] No bot account connected; Twitch integration is disabled.');
}
authProvider.addUser(doc.twitchuserid, { accessToken: doc.twitchaccess, scope: ['chat:read', 'chat:edit'], refreshToken: doc.twitchrefresh, expiresIn: doc.twitchexpires, obtainmentTimestamp: doc.twitchobtained, }, ['chat']);
authProvider.onRefresh(async (_userId, newTokenData) => {
        await twitchconfig.updateOne({}, {
            $set: {
                twitchaccess: newTokenData.accessToken,
                twitchrefresh: newTokenData.refreshToken,
                twitchexpires: newTokenData.expiresIn,
                twitchobtained: newTokenData.obtainmentTimestamp,
            },
        });
    });
    authProvider.onRefreshFailure((userId, error) => console.error(`[twitch] token refresh failed for ${userId}`, error));

const apiClient = new ApiClient({ authProvider });
const twitchUser = await apiClient.users.getUserById(doc.twitchuserid);
const twitchChatClient = new ChatClient({ authProvider, channels: [twitchUser!.name] });
const eventSubListener = new EventSubWsListener({ apiClient });
export { eventSubListener, twitchChatClient, doc, apiClient, authProvider }