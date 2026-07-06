import type { APIMessage } from 'discord-api-types/payloads';
import { usersCollection, guildconfigs } from './Database';
import { response } from './rest';
interface xp {
    Id: string;
    source: 'discord' | 'twitch';
    channel?: string;
    roles?: string[],
    guildId?: string
}
export async function grantXp({ Id, source, channel, roles, guildId = '1231453115937587270' }: xp) {
    if (guildId != '1231453115937587270')
        return;
    const { baseMultiplier, exponent, flatOffset, roundToNearest, publicChannels } = await guildconfigs.findOne(
        { guildId: '1231453115937587270' },
        { projection: { baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1, publicChannels: 1 } }
    ) as any;

    const { xp, level, avatar, nick, userId } = await usersCollection.findOneAndUpdate(
        source == 'discord' ? { userId: Id, guildId: '1231453115937587270' } : { twitchId: Id }, { $inc: { xp: 20 } }, { upsert: true, returnDocument: 'after', projection: { xp: 1, level: 1, avatar: 1, nick: 1 } }) as any;

    if (level < 100 && xp >= Math.round((level ** exponent * baseMultiplier + flatOffset) / roundToNearest)) {
        await usersCollection.updateOne({ userId, guildId: '1231453115937587270' }, { $inc: { level: 1 }, $set: { xp: 0 } });
        if (source == 'discord') {
            if (parseInt(level) + 1 > 2 && !roles!.includes("1334238580914131026") && guildId == '1231453115937587270')
                await response({ method: "PUT", endpoint: `guilds/1231453115937587270/members/${userId}/roles/1334238580914131026` })
            const rank = await usersCollection.countDocuments({ guildId: '1231453115937587270', $or: [{ level: { $gt: level + 1 } }, { level: level + 1, xp: { $gt: xp } }] });
            await response({
                method: 'POST',
                endpoint: `channels/${publicChannels.generalChannel}/messages`,
                body: { embeds: [{ author: { name: nick, icon_url: `https://cdn.discordapp.com/avatars/${userId}/${avatar}${avatar!.includes('a_') ? '.gif' : '.png'}` }, description: `<@${userId}> reached level ${level + 1}! You are now #${rank + 1} in the server`, color: 0x00AE86 }] } as APIMessage
            });
        }
        else if (source == 'twitch') {

        }


    }
}