import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { twitchconfig, usersCollection } from './Database';
import { awardXp } from './xp';

const authConfig = { clientId: process.env.TWITCH_ID!, clientSecret: process.env.TWITCH_SECRET!, redirectUri: `${process.env.DISCORD_REDIRECT!}/api/auth/twitch/redirect` };
const authProvider = new RefreshingAuthProvider(authConfig);
const apiClient = new ApiClient({ authProvider });

authProvider.onRefresh(async (userId, newTokenData) => {
    await twitchconfig.updateMany({ twitchuserid: userId }, {
        $set: {
            twitchaccess: newTokenData.accessToken,
            twitchrefresh: newTokenData.refreshToken,
            twitchexpires: newTokenData.expiresIn,
            twitchobtained: newTokenData.obtainmentTimestamp,
        },
    });
});
authProvider.onRefreshFailure((userId, error) => console.error(`[twitch] token refresh failed for ${userId}`, error));
const savedConfigs = await twitchconfig.find({ twitchuserid: { $exists: true }, twitchaccess: { $exists: true } }).toArray();
for (const config of savedConfigs) {
    const userId = String(config.twitchuserid);
    if (authProvider.hasUser(userId)) continue;
    authProvider.addUser(userId, {
        accessToken: String(config.twitchaccess),
        scope: ['chat:read', 'chat:edit'],
        refreshToken: String(config.twitchrefresh ?? ''),
        expiresIn: Number(config.twitchexpires ?? 0),
        obtainmentTimestamp: Number(config.twitchobtained ?? 0),
    }, ['chat']);
}

type TwitchRuntime = {
    version: string;
    twitchUserId: string;
    authProvider: RefreshingAuthProvider;
    chatClient: ChatClient;
    eventSubListener: EventSubWsListener;
    subscriptions: ReturnType<EventSubWsListener['onStreamOnline']>[];
};

const runtimes = new Map<string, TwitchRuntime>();
let isSyncing = false;

function stopRuntime(runtime: TwitchRuntime) {
    runtime.authProvider.removeUser(runtime.twitchUserId);
    for (const subscription of runtime.subscriptions) subscription.stop();
    runtime.eventSubListener.stop();
    runtime.chatClient.quit();
}

export async function syncTwitchConfigs() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const docs = await twitchconfig.find(
            { twitchuserid: { $exists: true }, twitchaccess: { $exists: true } },
            { projection: { guildId: 1, twitchuserid: 1, twitchaccess: 1, twitchrefresh: 1, twitchexpires: 1, twitchobtained: 1, twitchConfigUpdated: 1 } },
        ).toArray();
        const configs = new Map(docs.filter(doc => doc.guildId && doc.twitchuserid && doc.twitchaccess).map(doc => [String(doc.guildId), doc]));

        for (const [guildId, runtime] of runtimes) {
            const config = configs.get(guildId);
            const version = config ? String(config.twitchConfigUpdated ?? `legacy:${config.twitchuserid}`) : null;
            if (!config || version !== runtime.version) {
                stopRuntime(runtime);
                runtimes.delete(guildId);
            }
        }

        const pendingConfigs = [...configs].filter(([guildId]) => !runtimes.has(guildId));
        for (let offset = 0; offset < pendingConfigs.length; offset += 4) {
            const batch = pendingConfigs.slice(offset, offset + 4);
            await Promise.all(batch.map(async ([guildId, config]) => {
                const version = String(config.twitchConfigUpdated ?? `legacy:${config.twitchuserid}`);
                const provider = new RefreshingAuthProvider(authConfig);
                provider.addUser(String(config.twitchuserid), {
                    accessToken: String(config.twitchaccess),
                    scope: ['chat:read', 'chat:edit'],
                    refreshToken: String(config.twitchrefresh ?? ''),
                    expiresIn: Number(config.twitchexpires ?? 0),
                    obtainmentTimestamp: Number(config.twitchobtained ?? 0),
                }, ['chat']);
                provider.onRefresh(async (userId, newTokenData) => {
                    await twitchconfig.updateOne({ guildId, twitchuserid: userId }, {
                        $set: {
                            twitchaccess: newTokenData.accessToken,
                            twitchrefresh: newTokenData.refreshToken,
                            twitchexpires: newTokenData.expiresIn,
                            twitchobtained: newTokenData.obtainmentTimestamp,
                        },
                    });
                });
                provider.onRefreshFailure((userId, error) => console.error(`[twitch] token refresh failed for ${userId}`, error));

                try {
                    const guildApiClient = new ApiClient({ authProvider: provider });
                    const [twitchUser, currentStream] = await Promise.all([
                        guildApiClient.users.getUserById(String(config.twitchuserid)),
                        guildApiClient.streams.getStreamByUserId(String(config.twitchuserid)),
                    ]);
                    if (!twitchUser) throw new Error(`Twitch user ${config.twitchuserid} was not found`);

                    const chatClient = new ChatClient({ authProvider: provider, channels: [twitchUser.name] });
                    chatClient.onMessage((channel, user, text) => {
                        void (async () => {
                            if (text.startsWith('!lvl')) {
                                const record = await usersCollection.findOne({ twitchChannelLogin: user, guildId }, { projection: { xp: 1, level: 1 } }) as { xp: number; level: number } | null;
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
                            const levelUp = await awardXp({ twitchChannelLogin: user, guildId }, guildId);
                            if (levelUp) await chatClient.say(channel, `@${user} reached level ${levelUp.level}! You are now #${levelUp.rank + 1}!`);
                        })().catch(error => console.error('[twitch] message handler failed', error));
                    });
                    chatClient.onMessageFailed((channel, reason) => console.log('[twitch] message failed', channel, reason));
                    chatClient.onMessageRatelimit((channel, message) => console.log('[twitch] ratelimited', channel, message));

                    const eventSubListener = new EventSubWsListener({ apiClient: guildApiClient });
                    eventSubListener.start();
                    const onlineSubscription = eventSubListener.onStreamOnline(String(config.twitchuserid), () => {
                        if (!chatClient.isConnected && !chatClient.isConnecting) chatClient.connect();
                        console.info(`[twitch] chat connected for guild ${guildId}`);
                    });
                    const offlineSubscription = eventSubListener.onStreamOffline(String(config.twitchuserid), () => {
                        chatClient.quit();
                        console.info(`[twitch] chat disconnected for guild ${guildId}`);
                    });
                    runtimes.set(guildId, {
                        version,
                        twitchUserId: String(config.twitchuserid),
                        authProvider: provider,
                        chatClient,
                        eventSubListener,
                        subscriptions: [onlineSubscription, offlineSubscription],
                    });
                    if (currentStream) chatClient.connect();
                    console.info(`[twitch] configured for guild ${guildId}`);
                } catch (error) {
                    console.error(`[twitch] could not configure guild ${guildId}`, error);
                }
            }));
        }
    } finally {
        isSyncing = false;
    }
}

export { apiClient, authProvider };