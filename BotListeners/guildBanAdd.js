import { EmbedBuilder, AuditLogEvent } from "discord.js";
import { load, save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};
const recentBans = new Map();
async function sendMassBanEmbed(executorId, channel) {
    const entry = recentBans.get(executorId);
    const { executor, bans } = entry;
    const banlog = new EmbedBuilder()
        .setAuthor({
            name: `${executor.tag} ${`mass banned`}`,
            iconURL: executor.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`Mass Ban: ${bans.length} Members Banned`)
        .setDescription(bans.map(ban => `**Tag**: \`${ban.userTag}\` \n**ID**: \`${ban.userId}\`\n**Reason**: \`${ban.reason}\``).join('\n\n'))
        .setColor(0x900000)
        .setFooter({ text: `Banned by ${executor.tag}`, iconURL: executor.displayAvatarURL({ dynamic: true }) })
        .setTimestamp()

    await channel.send({ embeds: [banlog] })
    recentBans.delete(executorId);
}
export async function guildBanAdd(ban) {
    const filepath = "Extravariables/commandsbans.json"
    const bans = await load(filepath);
    const user = ban.user
    if (bans.includes(user.id)) {
        save(filepath, [])
        return;
    }
    const banlogChannel = await ban.guild.channels.fetch(guildChannelMap[ban.guild.id].modChannels.banlogChannel);

    if (!banlogChannel) return;

    try {
        const auditLogs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 10 });
        const banEntry = auditLogs.entries.find(entry => entry.target.id === user.id);

        if (!banEntry) {
            console.log(`Audit log entry not found for ban of ${user.tag}.`);
            return;
        }
        const executorId = banEntry.executor.id;
        const newBanData = {
            user: user,
            userTag: user.tag,
            userId: user.id,
            reason: banEntry.reason || "No reason provided."
        };
        const existingEntry = recentBans.get(executorId);
        if (existingEntry) {
            clearTimeout(existingEntry.timeout);
            existingEntry.bans.push(newBanData);
            existingEntry.timeout = setTimeout(() => sendMassBanEmbed(executorId, banlogChannel), 3000);
            recentBans.set(executorId, existingEntry);
        } else {
            const newEntry = {
                executor: banEntry.executor,
                bans: [newBanData],
                timeout: setTimeout(() => sendMassBanEmbed(executorId, banlogChannel), 3000)
            }
            recentBans.set(executorId, newEntry);
        }
    } catch (error) {
        console.error(`Error processing ban for ${user.tag}:`, error)
    }
}