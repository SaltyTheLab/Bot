import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { twitchconfig, usersCollection } from './Database';
import awardXp from './xp';
const authProvider = new RefreshingAuthProvider({
    clientId: process.env.TWITCH_ID!,
    clientSecret: process.env.TWITCH_SECRET!,
    redirectUri: `${process.env.DISCORD_REDIRECT!}/api/auth/twitch/redirect`,
});

const apiClient = new ApiClient({ authProvider });

authProvider.onRefreshFailure((userId, error) => {
    console.error(`[twitch] token refresh failed for ${userId}`, error);
});

authProvider.onRefresh(async (userId, token) => {
    await twitchconfig.updateOne(
        { twitchuserid: userId },
        {
            $set: {
                twitchaccess: token.accessToken,
                twitchrefresh: token.refreshToken,
                twitchexpires: token.expiresIn,
                twitchobtained: token.obtainmentTimestamp,
                twitchscopes: token.scope,
            },
        },
    );
});

const twitch = await twitchconfig.findOne({ twitchuserid: '901114331' });

if (twitch) {
    const scopes: string[] = Array.isArray(twitch.twitchscopes) ? twitch.twitchscopes : [];
    const missingScopes = ['chat:read', 'chat:edit'].filter(scope => !scopes.includes(scope));

    if (missingScopes.length > 0) {
        throw new Error(
            `[twitch] Saved token is missing ${missingScopes.join(', ')}. Reconnect Twitch through the website to grant chat access.`,
        );
    }

    authProvider.addUser(
        twitch.twitchuserid,
        {
            accessToken: twitch.twitchaccess,
            refreshToken: twitch.twitchrefresh,
            expiresIn: twitch.twitchexpires,
            obtainmentTimestamp: twitch.twitchobtained,
            scope: scopes,
        },
        ['chat'],
    );

    const twitchUser = await apiClient.users.getUserById(twitch.twitchuserid);
    if (!twitchUser) throw new Error(`[twitch] User ${twitch.twitchuserid} was not found`);

    const chatClient = new ChatClient({ authProvider, channels: [twitchUser.name], });
    chatClient.onTokenFetchFailure(error => {
        console.error('[twitch] chat token fetch failed:', error);
        if (error instanceof Error) console.error(error.stack);
    });

    chatClient.onMessage(async (channel, user, text) => {

        if (text.startsWith('!lvl')) {
            const record = await usersCollection.findOne(
                { twitchChannelLogin: user, guildId: twitch.guildId },
                { projection: { xp: 1, level: 1 } },
            ) as { xp: number; level: number } | null;

            if (!record) {
                await chatClient.say(channel, 'Your Twitch channel is not linked, please link it using /link in my server');
                return;
            }

            await chatClient.say(channel, `@${user}, your level is currently ${record.level}, with ${record.xp} xp.`);
            return;
        }

        if (text.startsWith('!discord')) {
            await chatClient.say(channel, 'I have a discord at https://discord.gg/f7ru3KcPy5');
            return;
        }

        const levelUp = await awardXp({ twitchChannelLogin: user, guildId: twitch.guildId }, twitch.guildId);
        if (levelUp) {
            await chatClient.say(channel, `@${user} reached level ${levelUp.level}! You are now #${levelUp.rank + 1}!`);
        }
    })
    chatClient.onMessageFailed((channel, reason) => {
        console.log('[twitch] message failed', channel, reason);
    });
    chatClient.onMessageRatelimit((channel, message) => {
        console.log('[twitch] ratelimited', channel, message);
    });

    const eventSubListener = new EventSubWsListener({ apiClient });
    eventSubListener.onStreamOnline(twitch.twitchuserid, () => {
        if (!chatClient.isConnected && !chatClient.isConnecting) chatClient.connect();
        console.info(`[twitch] chat connected for guild ${twitch.guildId}`);
    });
    eventSubListener.onStreamOffline(twitch.twitchuserid, () => {
        chatClient.quit();
        console.info(`[twitch] chat disconnected for guild ${twitch.guildId}`);
    });
    eventSubListener.start();
} else {
    console.info('[twitch] no Twitch account is configured');
}

export { authProvider, apiClient };