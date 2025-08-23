import { EmbedBuilder } from "discord.js";
import guildChannelMap from "./Extravariables/channelconfiguration.js";
import { getPunishments } from "../Database/databasefunctions.js";

/**
 * Handles the guildBanRemove event to log when a ban is lifted.
 * @param {import("discord.js").GuildBan} ban - The GuildBan object representing the unban.
 */
export async function guildBanRemove(ban) {
    const guildId = ban.guild.id
    const modChannels = guildChannelMap[guildId].modChannels

    // Get the ban log channel
    const banlogChannel = await ban.guild.channels.fetch(modChannels.banlogChannel);

    if (!banlogChannel) {
        console.warn('⚠️ Ban log channel not found for unban.');
        return;
    }

    try {
        const punishments = await getPunishments(ban.user.id, ban.guild.id);
        const bans = punishments.filter(punishment => punishment.warnType === 'Ban');

        // Create an embed for the unban
        const embed = new EmbedBuilder()
            .setColor(0x309eff) // A distinct color for unbans
            .setTitle('A member was unbanned')
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
            .setDescription([
                `**User**: ${ban.user}`,
                `**Tag**: \`${ban.user.tag}\``,
                `**Id**: \`${ban.user.id}\`\n\n`,
                `**Reason**: \`${bans.reason ? `${bans.reason}` : 'No reasons provided'}\``
            ].join('\n'))
            .setTimestamp()

        await banlogChannel.send({ embeds: [embed] });
        console.log(`User ${ban.user.tag} was unbanned.`);
    } catch (error) {
        console.error(`Error logging unban for ${ban.user.tag}:`, error);
    }

}
