import { EmbedBuilder } from "discord.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
import { getPunishments } from "../Database/databasefunctions.js";

/**
 * Handles the guildBanRemove event to log when a ban is lifted.
 * @param {import("discord.js").GuildBan} ban - The GuildBan object representing the unban.
 */
export async function guildBanRemove(ban) {
    const user = ban.user
    const guild = ban.guild
    const modChannels = guildChannelMap[guild.id].modChannels
    const banlogChannel = await guild.channels.fetch(modChannels.banlogChannel);

    if (!banlogChannel) {
        console.warn('⚠️ Ban log channel not found for unban.');
        return;
    }

    try {
        const punishments = await getPunishments(user.id, guild.id);
        const bans = punishments.filter(punishment => punishment.type === 'Ban');
        // Create an embed for the unban
        const embed = new EmbedBuilder()
            .setColor(0x309eff) // A distinct color for unbans
            .setTitle('A member was unbanned')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setDescription([
                `**User**: ${user}`,
                `**Tag**: \`${user.tag}\``,
                `**Id**: \`${user.id}\`\n`,
                `**Reason**: \`${bans.length > 0 ? bans[0].reason : 'No reasons provided'}\``
            ].join('\n'))
            .setTimestamp()

        await banlogChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`Error logging unban for ${user.tag}:`, error);
    }
}
