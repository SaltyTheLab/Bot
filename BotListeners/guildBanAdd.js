import { EmbedBuilder, AuditLogEvent } from "discord.js";
import { load, save } from "../utilities/jsonloaders.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
const recentBans = new Map();
async function sendMassBanEmbed(executorId, channel) {
    const entry = recentBans.get(executorId);
    const { executor, bans } = entry;
    if (bans.length > 1) {
        const banlog = new EmbedBuilder()
            .setAuthor({
                name: `${executor?.tag} ${`mass banned`}`,
                iconURL: executor?.displayAvatarURL({ dynamic: true })
            })
            .setTitle(`Mass Ban: ${bans.length} Members Banned`)
            .setDescription(bans.map(ban => [`**Tag**: \`${ban.userTag}\``, `**ID**:\`${ban.userId}\``, `**Reason**:\`${ban.reason}\``].join('\n')).join('\n\n'))
            .setColor(0x900000)
            .setFooter({ text: `Banned by ${executor?.tag}`, iconURL: executor.displayAvatarURL({ dynamic: true }) })
            .setTimestamp()

        await channel.send({ embeds: [banlog] })
        recentBans.delete(executorId);
    }
}
export async function guildBanAdd(ban) {
    const bans = await load("BotListeners/Extravariables/commandsbans.json");
    const user = ban.user
    if (bans.includes(user.id)) {
        bans.pop();
        save("BotListeners/Extravariables/commandsbans.json", bans)
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
            entry.timeout = setTimeout(() => sendMassBanEmbed(executorId, banlogChannel), 3000)
        } else {
            const newEntry = {
                executor: banEntry.executor,
                bans: [banData],
                timeout: setTimeout(() => sendMassBanEmbed(executorId, banlogChannel), 3000)
            }
            recentBans.set(executorId, newEntry)
        }
    } catch (error) {
        console.error(`Error processing ban for ${user.tag}:`, error)
    }
}