import { EmbedBuilder, AuditLogEvent } from "discord.js";
import guildChannelMap from "./Extravariables/channelconfiguration.js";

export async function guildBanAdd(ban) {
    const user = ban.user;
    const guild = ban.guild;
    const banlogChannel = await guild.channels.fetch(guildChannelMap[ban.guild.id].modChannels.banlogChannel);

    if (!banlogChannel) return;

    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const banEntry = auditLogs.entries.find(entry => entry.target.id === user.id);

    if (banEntry.executor.id === guild.client.user.id) {
        console.log(`Bot-initiated ban of ${user.tag} detected. Skipping duplicate log.`);
        return;
    }
    const banlog = new EmbedBuilder()
        .setAuthor({
            name: `${banEntry?.excutor?.tag || 'Unknown User'} banned a member`,
            iconURL: banEntry?.excutor?.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'User', value: `<@${user.id}>`, inline: true },
            { name: 'Tag:', value: `\`${user.tag}\``, inline: true },
            { name: 'id', value: `\`${user.id}\``, inline: true },
            { name: 'Reason', value: `\`${ban.reason}\`` }
        )
        .setFooter({ text: banEntry.createdAt })
    await banlogChannel.send({ embeds: [banlog] })
}