import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { usersCollection, twitchconfig } from './Database';
import { awardXp } from './xp';
export async function startTwitchIntegration() {
    const authProvider = new RefreshingAuthProvider({ clientId: Bun.env.TWITCH_ID!, clientSecret: Bun.env.TWITCH_SECRET! });
    const doc = await twitchconfig.findOne({}, { projection: { twitchuserid: 1, twitchaccess: 1, twitchrefresh: 1, twitchexpires: 1, twitchobtained: 1 } }) as any;
    if (!doc?.twitchuserid || !doc?.twitchaccess) {
        console.info('[twitch] No bot account connected; Twitch integration is disabled.');
        return;
    }
    authProvider.addUser(doc.twitchuserid, {
        accessToken: doc.twitchaccess,
        scope: ['chat:read', 'chat:edit'],
        refreshToken: doc.twitchrefresh,
        expiresIn: doc.twitchexpires,
        obtainmentTimestamp: doc.twitchobtained,
    }, ['chat']);
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
    if (!twitchUser) {
        console.warn(`[twitch] Could not resolve connected account ${doc.twitchuserid}.`);
        return;
    }
    const twitchChatClient = new ChatClient({ authProvider, channels: [twitchUser.name] });
    twitchChatClient.onMessage(async (channel, user, text) => {
        if (text.startsWith('!lvl')) {
            const record = await usersCollection.findOne({ twitchChannelLogin: user }, { projection: { xp: 1, level: 1 } }) as any;
            if (!record) {
                await twitchChatClient.say(channel, 'Your Twitch channel is not linked, please link it using /link in my server');
                return;
            }
            await twitchChatClient.say(channel, `@${user}, your level is currently ${record.level}, with ${record.xp} xp.`);
            return;
        }
        if (text.startsWith('!discord')) {
            await twitchChatClient.say(channel, 'I have a discord at https://discord.gg/f7ru3KcPy5');
            return;
        }
        const guildId = await twitchconfig.findOne({}, { projection: { guildId: 1 } })
        const levelUp = await awardXp({ twitchChannelLogin: user }, guildId!.guildId);
        if (levelUp) await twitchChatClient.say(channel, `@${user} reached level ${levelUp.level}! You are now #${levelUp.rank + 1}!`);
    });
    twitchChatClient.onMessageFailed((channel, reason) => console.log('[twitch] message failed', channel, reason));
    twitchChatClient.onMessageRatelimit((channel, msg) => console.log('[twitch] ratelimited', channel, msg));

    const eventSubListener = new EventSubWsListener({ apiClient });
    eventSubListener.start();
    eventSubListener.onStreamOnline(doc.twitchuserid, () => {
        twitchChatClient.connect();
        console.info('[twitch] chat connected');
    });
    eventSubListener.onStreamOffline(doc.twitchuserid, () => {
        twitchChatClient.quit();
        console.info('[twitch] chat disconnected');
    });
}