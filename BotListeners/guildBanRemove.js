import { EmbedBuilder, AuditLogEvent } from "discord.js";
import { banlogChannelid } from "./Extravariables/channelids.js";

/**
 * Handles the guildBanRemove event to log when a ban is lifted.
 * @param {import("discord.js").GuildBan} ban - The GuildBan object representing the unban.
 */
export async function guildBanRemove(ban) {
    // Get the ban log channel
    const banlogChannel = ban.guild.channels.cache.get(banlogChannelid);

    if (!banlogChannel) {
        console.warn('⚠️ Ban log channel not found for unban.');
        return;
    }

    const now = Date.now();
    // A small buffer to account for audit log propagation delays
    const isRecent = (timestamp) => now - timestamp < 5000;

    let reason = "No reason provided.";

    try {
        // Fetch audit logs for MemberBanRemove to find the executor and reason
        const unbanLogs = await ban.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 5 // Limit to recent entries for efficiency
        });

        // Find the specific unban entry for this user
        const unbanLog = unbanLogs.entries.find((entry) =>
            entry.target.id === ban.user.id && isRecent(entry.createdTimestamp)
        );

        if (unbanLog)
            reason = unbanLog.reason ?? "No reason provided.";

        // Create an embed for the unban
        const embed = new EmbedBuilder()
            .setColor(0x309eff) // A distinct color for unbans
            .setTitle('A member was unbanned')
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User', value: `${ban.user}`, inline: true },
                { name: 'Tag', value: `\`${ban.user.tag}\``, inline: true },
                { name: 'id', value: `\`${ban.user.id}>\``, inline: true },
                { name: 'Reason', value: reason }
            );

        await banlogChannel.send({ embeds: [embed] });
        console.log(`User ${ban.user.tag} was unbanned.`);

    } catch (error) {
        console.error(`Error logging unban for ${ban.user.tag}:`, error);
    }
}
