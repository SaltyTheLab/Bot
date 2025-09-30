import { EmbedBuilder, AuditLogEvent } from "discord.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
import { loadbans, saveBans } from "../utilities/jsonloaders.js";
const recentBans = new Map();

async function sendMassBanEmbed(executorId, guild, channel) {
    const entry = recentBans.get(executorId);
    const { executor, bans } = entry;
    const isMassban = bans.length > 1;
    const title = isMassban ? `Mass Ban: ${bans.length} Members Banned` : `Member Banned`;
    const banlog = new EmbedBuilder()
        .setAuthor({
            name: `${executor?.tag} ${isMassban ? `mass banned` : `banned a member`}`,
            iconURL: executor?.displayAvatarURL({ dynamic: true })
        })
        .setTitle(title)
        .setColor(0x900000)
        .setTimestamp()
    if (isMassban) {
        const description = bans.map(ban => [`**Tag**: \`${ban.userTag}\``, `**ID**:\`${ban.userId}\``, `**Reason**:\`${ban.reason}\``].join('\n')).join('\n\n');
        banlog
            .setDescription(description)
            .setFooter({ text: `Banned by ${executor?.tag}`, iconURL: executor.displayAvatarURL({ dynamic: true }) });
    } else {
        const singleBan = bans[0];
        banlog
            .setThumbnail(await guild.client.users.fetch(singleBan.userId).then(u => u.displayAvatarURL({ dynamic: true })))
            .setDescription(
                [
                    `**User**:${singleBan.user}`,
                    `**Tag**: \`${singleBan.userTag}\``,
                    `**ID**:\`${singleBan.userId}\`\n`,
                    `**Reason**:\`${singleBan.reason}\``
                ].join('\n')
            )
    }
    await channel.send({ embeds: [banlog] })
    recentBans.delete(executorId);
}
export async function guildBanAdd(ban) {
    const bans = await loadbans();
    const user = ban.user
    if (bans.includes(user.id)) {
        bans.pop();
        saveBans(bans)
        return;
    }
    const guild = ban.guild;
    const banlogChannel = await guild.channels.fetch(guildChannelMap[ban.guild.id].modChannels.banlogChannel);

    if (!banlogChannel) return;

    try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 10 });
        const banEntry = auditLogs.entries.find(entry => entry.target.id === user.id);

        if (!banEntry) {
            console.log(`Audit log entry not found for ban of ${user.tag}.`);
            return;
        }

        const executorId = banEntry.executor.id;
        const banData = {
            user: user,
            userTag: user.tag,
            userId: user.id,
            reason: banEntry.reason || "No reason provided."
        };

        if (recentBans.has(executorId)) {
            const entry = recentBans.get(executorId);
            entry.bans.push(banData);
            clearTimeout(entry.timeout)
            entry.timeout = setTimeout(() => sendMassBanEmbed(executorId, guild, banlogChannel), 3000)
        } else {
            const newEntry = {
                executor: banEntry.executor,
                bans: [banData],
                timeout: setTimeout(() => sendMassBanEmbed(executorId, guild, banlogChannel), 3000)
            }
            recentBans.set(executorId, newEntry)
        }
    } catch (error) {
        console.error(`Error processing ban for ${user.tag}:`, error)
    }
}


