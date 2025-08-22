import { EmbedBuilder, AuditLogEvent } from "discord.js";
import guildChannelMap from "./Extravariables/channelconfiguration.js";

export async function guildMemberRemove(member) {
    const guildId = member.guild.id
    const modChannels = guildChannelMap[guildId].modChannels
    //define welcomechannel and banlog channel
    const [welcomeChannel, banlogChannel, muteLogChannel] = [
        member.guild.channels.cache.get(modChannels.welcomeChannel),
        member.guild.channels.cache.get(modChannels.banlogChannel),
        member.guild.channels.cache.get(modChannels.mutelogChannel)
    ]
    if (!welcomeChannel) {
        console.warn('⚠️ Welcome channel not found.');
        return;
    }

    //set default actions and leave executor null
    let action = "leave";
    let executor = null;
    let reason = ``;

    const auditLogTypes = [AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberKick];
    const auditLogs = await Promise.all(
        auditLogTypes.map(type => member.guild.fetchAuditLogs({ type, limit: 1 }))
    );

    const recentEntry = auditLogs.flatMap(log => log.entries).find(entry => entry.id === member.user.id && Date.now() - entry.createdTimestamp < 5000);

    if (recentEntry) {
        action = recentEntry.action === AuditLogEvent.MemberBanAdd ? 'ban' : 'kick';
        executor = recentEntry.executor;
        reason = recentEntry.reason ?? "no reason provieded"
    } else if (member.joinedAt) {
        const joinAgeMs = Date.now() - member.joinedAt.getTime();
        const accountAgeMs = Date.now() - member.user.createdeTimestamp;
        const isPrune = joinAgeMs < 7 * 24 * 60 * 60 * 1000 && accountAgeMs > 30 * 24 * 60 * 60 * 1000;
        if (isPrune) action = "prune";
    }

    // Create leave message embed
    const embed = new EmbedBuilder()
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({
            name: 'Joined the cave on:',
            value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : 'Unknown',
            inline: true
        })
        .setFooter({ text: new Date(recentEntry?.createdTimestamp || Date.now()).toLocaleString() })

    // Customize message by action
    switch (action) {
        case "ban":
            if (executor && executor.id === member.client.user.id) {
                console.log(`Bot-initiated ban of ${member.user.tag} detected. Skipping duplicate log in guildMemberRemove.`);
                break;
            }
            embed
                .setColor(0x8b0000)
                .setTitle(`${executor.tag} banned a member`)
                .addFields(
                    { name: 'User', value: `${member}`, inline: true },
                    { name: 'Tag:', value: `\`${member.user.tag}\``, inline: true },
                    { name: 'id', value: `\`${member.user.id}\``, inline: true },
                    { name: 'Reason', value: `\`${reason}\`` }
                )
            await banlogChannel.send({ embeds: [embed] });
            break;

        case "kick":
        case "prune":
            embed
                .setColor(action === "kick" ? 0xff5555 : 0xffaa00)
                .setTitle(action === "kick" ? `${executor.tag} kicked a member` : `A member was likely pruned`)
                .setDescription(action === "prune" ? `${member} was probably removed in a prune.` : null)
            await muteLogChannel.send({ embeds: [embed] });
            break;

        default:
            embed
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`<@${member.id}> left the cave.`)
                .addFields({
                    name: 'Joined the cave on:',
                    value: member.joinedAt
                        ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
                        : 'Unknown',
                    inline: true,
                })
                .setTimestamp()
            break;
    }
    const leaveembed = new EmbedBuilder()
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`<@${member.id}> left the cave.`)
        .addFields({
            name: 'Joined the cave on:',
            value: member.joinedAt
                ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
                : 'Unknown',
            inline: true,
        })
    await welcomeChannel.send({ embeds: [leaveembed] });
}
