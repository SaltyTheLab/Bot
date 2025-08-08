import { EmbedBuilder, AuditLogEvent } from "discord.js";
import { guildModChannelMap } from "./Extravariables/channelids.js";
import { welcomeChannelId, banlogChannelid, mutelogChannelid } from "./Extravariables/channelids.js";

export async function guildMemberRemove(member) {
    const guildId = member.guild.id
    const guildChannels = guildModChannelMap[guildId] 
    //define welcomechannel and banlog channel
    const [welcomeChannel, banlogChannel, muteLogChannel] = [member.guild.channels.cache.get(welcomeChannelId),
    member.guild.channels.cache.get(guildChannels.banlogChannel),
    member.guild.channels.cache.get(guildChannels.mutelogChannel)
    ]
    if (!welcomeChannel) {
        console.warn('⚠️ Welcome channel not found.');
        return;
    }

    const now = Date.now();
    const isRecent = (timestamp) => now - timestamp < 5000;

    //set default actions and leave executor null
    let action = "leave";
    let executor = null;
    let reason = ``;
    let time = now;

    // Check for ban/kick in audit
    const banLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd
    });
    const banLog = banLogs.entries.find((entry) =>
        entry.target.id === member.id && isRecent(entry.createdTimestamp)
    );
    const kickLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 5,
    });

    const kickLog = kickLogs.entries.find((entry) =>
        entry.target.id === member.id && isRecent(entry.createdTimestamp)
    );

    //determine variables based on action
    if (banLog) {
        action = "ban";
        executor = banLog.executor;
        reason = banLog.reason ?? "No reason provided.";
        time = new Date(banLog.createdTimestamp).toLocaleString()
    }
    // Check for kick if not banned
    if (kickLog) {
        action = "kick";
        executor = kickLog.executor;
        reason = kickLog.reason ?? "No reason provided.";
        time = new Date(kickLog.createdTimestamp).toLocaleString()
    }

    // Heuristic for prune detection
    if (action === "leave") {
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        const joinAgeMs = member.joinedAt ? Date.now() - member.joinedAt.getTime() : null;

        if (joinAgeMs !== null && joinAgeMs < 7 * 24 * 60 * 60 * 1000 && accountAgeMs > 30 * 24 * 60 * 60 * 1000) {
            // Joined less than 7 days ago, but account older than 30 days → likely prune
            action = "prune";
        }

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

    // Create leave message embed
    const embed = new EmbedBuilder()
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({
            name: 'Joined the cave on:',
            value: member.joinedAt
                ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
                : 'Unknown',
            inline: true,
        })
        .setFooter({ text: time });

    // Customize message by action
    switch (action) {
        case "ban":
            embed
                .setColor(0x8b0000)
                .setTitle(`${executor.tag} banned a member`)
                .addFields(
                    { name: 'User', value: `${member}`, inline: true },
                    { name: 'Tag:', value: `\`${member.user.tag}\``, inline: true },
                    { name: 'id', value: `\`${member.user.id}\``, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setFooter({ text: time })
            await banlogChannel.send({ embeds: [embed] });
            break;

        case "kick":
            embed
                .setColor(0xff5555)
                .setTitle(`${executor.tag} kicked a member`)
                .addFields(
                    { name: 'User', value: `${member}`, inline: true },
                    { name: 'Tag:', value: `\`${member.user.tag}\``, inline: true },
                    { name: 'Id:', value: `\`${member.user.id}\``, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setFooter({ text: time })
            await muteLogChannel.send({ embeds: [embed] });
            break;

        case "prune":
            embed
                .setColor(0xffaa00)
                .setTitle('A member was likely pruned')
                .setDescription(`${member} was probably removed in a server prune.`)
                .setFooter({ text: time });
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
    await welcomeChannel.send({ embeds: [leaveembed] });
}
