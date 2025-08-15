import invites from "../BotListeners/Extravariables/invites.js";
/**
 * Initializes the invite cache for the guild.
 * @param {import("discord.js").Client} client The Discord client.
 */
export default async function initializeInvites(client) {
    await client.guilds.fetch();
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const guildInvites = await guild.invites.fetch();
            guildInvites.forEach(invite => {
                // Use guildId from the outer loop for consistency
                invites.set(`${guildId}-${invite.code}`, invite.uses);
            });
            console.log(`Invites cache initialized for guild: ${guild.name} (${guildId}).`);
        } catch (error) {
            console.error(`Error fetching invites for guild ${guild.name} (${guildId}):`, error);
        }
    }
    // Debugging log for initial invite cache state
    console.log('--- Initial Invites Cache State ---');
    for (const [key, uses] of invites) {
        console.log(`${key}, Uses: ${uses}`);
    }
    console.log('-----------------------------------');
}