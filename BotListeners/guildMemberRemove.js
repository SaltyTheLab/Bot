import { EmbedBuilder, AuditLogEvent, Embed } from "discord.js";
import { welcomeChannelId } from "./Extravariables/channelids.js";
import { banlogChannelid } from "./Extravariables/channelids.js";

export async function guildMemberRemove(member) {
    //define welcomechannel and banlog channel
    const [welcomeChannel, banlogChannel] = [member.guild.channels.cache.get(welcomeChannelId),
    member.guild.channels.cache.get(banlogChannelid)
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
    let reason = "N/A";
    let time = now;

    // Check for ban in audit
    const banLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd
    });
    const banLog = banLogs.entries.find((entry) =>
        entry.target.id === member.id && isRecent(entry.createdTimestamp)
    );

    //determine variables based on action
    if (banLog) {
        action = "ban";
        executor = banLog.executor;
        reason = banLog.reason ?? "No reason provided.";
        time = banLog.createdTimestamp;
    }

    // Check for kick if not banned
    if (action === "leave") {
        const kickLogs = await member.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberKick,
            limit: 5,
        });

        const kickLog = kickLogs.entries.find((entry) =>
            entry.target.id === member.id && isRecent(entry.createdTimestamp)
        );

        if (kickLog) {
            action = "kick";
            executor = kickLog.executor;
            reason = kickLog.reason ?? "No reason provided.";
            time = kickLog.createdTimestamp;
        }
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
        });

    // Customize message by action
    if (action === "ban") {
        embed
            .setColor(0x8b0000)
            .setTitle('A member was banned')
            .addFields(
                { name: 'User', value: `<@${member.id}>`, inline: true },
                { name: 'Banned by', value: `<@${executor.id}>`, inline: true },
                { name: 'Reason', value: reason }
            );
        banlogChannel.send({ embeds: [embed] })
    } else if (action === "kick") {
        embed
            .setColor(0xff5555)
            .setTitle('A member was kicked')
            .addFields(
                { name: 'User', value: `<@${member.id}>`, inline: true },
                { name: 'Kicked by', value: `<@${executor.id}>`, inline: true },
                { name: 'Reason', value: reason }
            );
    } else if (action === "prune") {
        embed
            .setColor(0xffaa00)
            .setTitle('A member was likely pruned')
            .setDescription(`${member} was probably removed in a server prune.`);
    } else {
        embed
            .setColor(0xa90000)
            .setTitle('A member left the cave')
            .setDescription(`${member} has left the server.`);
    }
    //send embed
    await welcomeChannel.send({ embeds: [leaveembed] });
    if (action === "ban")
        await banlogChannel.send({ embeds: [embed] });
}
