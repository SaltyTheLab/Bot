import { type Document, type Filter } from 'mongodb';
import { guildconfigs, usersCollection } from './Database';

export async function awardXp(filter: Filter<Document>, guildId: string): Promise<{ level: number; rank: number } | null> {
    const config = await guildconfigs.findOne({guildId: guildId},
        { projection: { baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1 } },
    ) as { baseMultiplier: number; exponent: number; flatOffset: number; roundToNearest: number } | null;
    if(!config ||config?.baseMultiplier == 0 ) return null;
    const user = await usersCollection.findOneAndUpdate( filter, { $inc: { xp: 20 } }, { returnDocument: 'after', projection: { xp: 1, level: 1 } },
    ) as { level: number; xp: number } | null;
    if ( !user) return null;

    const { level, xp } = user;
    const requiredXp = Math.round((level ** config.exponent * config.baseMultiplier + config.flatOffset) / config.roundToNearest);
    if (level >= 100 || xp < requiredXp) return null;
    
    await usersCollection.updateOne(filter, { $inc: { level: 1 }, $set: { xp: 0 } });
    const rank = await usersCollection.countDocuments({
guildId,
        $or: [{ level: { $gt: level + 1 } }, { level: level + 1, xp: { $gt: xp } }],
    });
    return { level: level + 1, rank };
}