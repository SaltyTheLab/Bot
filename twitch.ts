import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { usersCollection, ws } from './Database';
import { grantXp } from './xp';

const doc = await ws.findOne({}, { projection: { twitchbot: 1, twitchaccess: 1, twitchrefresh: 1, twitchexpires: 1, twitchobtained: 1 } }) as any;
if (!doc?.twitchbot) throw new Error('No Twitch bot tokens found — run get-token.ts first.');

const authProvider = new RefreshingAuthProvider({ clientId: Bun.env.TWITCH_ID!, clientSecret: Bun.env.TWITCH_SECRET! });

authProvider.onRefresh(async (userId, newTokenData) => {
    await ws.updateOne({}, {
        $set: {
            twitchaccess: newTokenData.accessToken,
            twitchrefresh: newTokenData.refreshToken,
            twitchexpires: newTokenData.expiresIn,
            twitchobtained: Date.now(),
        }
    });
});

authProvider.addUser(doc.twitchbot, { accessToken: doc.twitchaccess, scope: ['chat:read', 'chat:edit'], refreshToken: doc.twitchrefresh, expiresIn: doc.twitchexpires, obtainmentTimestamp: doc.twitchobtained, }, ['chat']);
const chatClient = new ChatClient({ authProvider, channels: ['saltytbsl'] });
chatClient.connect();
chatClient.onAuthenticationSuccess(() => {
    chatClient.say('saltytbsl', 'Im here')
})

chatClient.onMessage(async (channel, user, text, msg) => {
    const twitchId = msg.userInfo.userId;
    if (text.startsWith('!verify ')) {
        const code = text.split(' ')[1]?.toUpperCase();
        const linkDoc = await usersCollection.findOne({ twitchLinkCode: code, twitchLinkExpires: { $gt: Date.now() } });
        if (!linkDoc) return chatClient.say(channel, `@${user} that code is invalid or expired.`);
        await usersCollection.updateOne({ _id: linkDoc._id }, { $set: { twitchId: twitchId }, $unset: { twitchLinkCode: '', twitchLinkExpires: '' } });
        return chatClient.say(channel, `@${user} linked to Discord! ✅`);
    }
    const linked = await usersCollection.findOne({ twitchId: twitchId }, { projection: { userId: 1 } });
    if (!linked) return;
    // await grantXp({ Id: linked.userId, source: 'twitch', channel: channel });
});