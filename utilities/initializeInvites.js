import invites from "../BotListeners/Extravariables/invites.js";
/**
 * Initializes the invite cache for the guild.
 * @param guild The GuildId of the guild.
 */
export default async function initializeInvites(guild) {
    try {
        const guildInvites = await guild.invites.fetch();
        guildInvites.forEach(invite => {
            // Use guildId from the outer loop for consistency
            invites.set(`${guild.id}-${invite.code}`, invite.uses);
        });
        console.log(`Invites cache initialized for guild:${guild.name} (${guild.id}).`);
    } catch (error) {
        console.error(`Error fetching invites for guild ${guild.name} (${guild.id}):`, error);
    }

}