import invites from "../BotListeners/Extravariables/mapsandsets.js";
/**
 * Initializes the invite cache for the guild.
 * @param guild The GuildId of the guild.
 */
export default async function initializeInvites(guild) {
    try {
        const guildInvites = await guild.invites.fetch();
        guildInvites.forEach(invite => {
            invites.set(`${guild.id}-${invite.code}`, invite.uses);
        });
    } catch (error) {
        console.error(`Error fetching invites for guild ${guild.name} (${guild.id}):`, error);
    }

}