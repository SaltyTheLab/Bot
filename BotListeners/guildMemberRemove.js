import { EmbedBuilder, AuditLogEvent } from "discord.js";
import guildChannelMap from "./Extravariables/channelconfiguration.js";

export async function guildMemberRemove(member) {
    const guildId = member.guild.id
    const modChannels = guildChannelMap[guildId].modChannels
    const [welcomeChannel, muteLogChannel] = [
        member.guild.channels.cache.get(modChannels.welcomeChannel),
        member.guild.channels.cache.get(modChannels.mutelogChannel)
    ]
    if (!welcomeChannel) {
        console.warn('⚠️ Welcome channel not found.');
        return;
    }

    //set default actions and leave executor null
    let action = "leave";
    let executor = null;
    let reason = '';

    const auditLogTypes = [AuditLogEvent.MemberKick, AuditLogEvent.MemberPrune];
    const auditLogs = await Promise.all(
        auditLogTypes.map(type => member.guild.fetchAuditLogs({ type, limit: 1 }))
    );

    const kickEntry = auditLogs[0].entries.find(entry => entry.target?.id === member.user.id && Date.now() - entry.createdTimestamp < 5000);
    if (kickEntry) {
        action = 'kick';
        reason = kickEntry.reason || reason;
        executor = kickEntry.executor;
    } else {
        const pruneEntry = auditLogs[1].entries.first();
        if (pruneEntry && Date.now() - pruneEntry.createdTimestamp < 10000 && pruneEntry.options?.members_removed > 0) {
            action = 'prune';
            reason = pruneEntry.reason || "Server prune";
        }
    }
    if (action === 'kick' || action === 'prune') {
        const embed = new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields({
                name: 'Joined the cave on:',
                value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : 'Unknown',
                inline: true
            })
            .setFooter({ text: new Date(kickEntry?.createdTimestamp || Date.now()).toLocaleString() })
        if (action == 'kick') {
            embed
                .setColor(0xff5555)
                .setTitle(`${executor.tag} kicked a member`)
                .addFields(
                    { name: 'User:', value: member },
                    { name: 'Reason:', value: `${reason}`, inline: false })
        } else if (action == 'prune') {
            embed
                .setColor(0xffaa00)
                .setTitle(`A member was likely pruned`)
                .setDescription(`${member} was probably removed in a prune.`)
                .addFields({ name: 'Reason:', value: `${reason}`, inline: false })
        }
        await muteLogChannel.send({ embeds: [embed] });
    }

    const leaveembed = new EmbedBuilder()
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`<@${member.id}> left ${member.guild.name}.`)
        .addFields({
            name: `Joined ${member.guild.name}:`,
            value: member.joinedAt
                ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
                : 'Unknown',
            inline: true,
        })
    await welcomeChannel.send({ embeds: [leaveembed] });
}
