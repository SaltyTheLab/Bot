import EmbedIDs from '../embeds/embedIDs.json' with {type: 'json'}
export default async function cacheInteractiveMessages(guild) {
    console.log('Attempting to cache all stored embeds...'); // Updated log

    // Iterate directly through the main array from the imported JSON config
    if (typeof EmbedIDs !== 'object' || EmbedIDs.length === 0) {
        console.log("ℹ️ EmbedIDs.json is not an object. No embeds to cache.");
        return;
    }
    const guildEmbeds = EmbedIDs[guild.id];
    if (!guildEmbeds || guildEmbeds.length === 0) {
        console.log(`ℹ️ No embeds found for guild ${guild.id}. Skipping cache.`);
        return;
    }
    const cachePromises = guildEmbeds.map(async (embedInfo) => {
        const { name, messageId, channelid } = embedInfo;
        if (!messageId || !channelid) {
            console.warn(`⚠️ Skipping caching for embed '${name}': Missing messageId or channelid.`);
            return { status: 'rejected', reason: 'Missing IDs' };
        }

        try {
            const channel = await guild.channels.fetch(channelid); // Use the channelid from JSON

            if (!channel) {
                console.warn(`⚠️ Channel with ID ${channelid} (for '${name}') not found. Skipping caching for this message.`);
                return;
            }

            if (!channel.isTextBased()) {
                console.warn(`⚠️ Channel '${channel.name}' (${channelid}) (for '${name}') is not text-based. Skipping caching.`);
                return;
            }

            const message = await channel.messages.fetch(messageId);
            if (message.reactions.length > 0) {
                channel.messages.cache.set(messageId, message);
                console.log(`✅ Successfully cached embed '${name}' (ID: ${message.id}) from channel '${channel.name}' (${channelid}).`);
            }
            return { status: 'fullfilled' }
        } catch (err) {
            const reason = err.code === 10003 ? "Discord API Error: Unknown Channel"
                : err.code === 10008 ? "Discord API Error: Unknown Message"
                    : err.message;
            console.error(`❌ Failed to cache embed '${name}' (ID: ${messageId}) in channel ${channelid}:`, reason);
            return { status: 'rejected', reason }
        }
    });

    await Promise.allSettled(cachePromises);
    console.log('Finished attempting to cache all stored embeds.');
}