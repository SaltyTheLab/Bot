import { EmbedBuilder, AuditLogEvent } from "discord.js";
import { load, save } from "../utilities/fileeditors.js";
import { getPunishments } from '../Database/databaseAndFunctions.js';
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
const recentBans = new Map();
async function sendMassBanEmbed(executorId, channel) {
    const entry = recentBans.get(executorId);
    const { executor, bans } = entry;
    await channel.send({
        embeds: [new EmbedBuilder({
            author: { name: `${executor.tag} ${`mass banned`}`, iconURL: executor.displayAvatarURL({ dynamic: true }) },
            title: `Mass Ban: ${bans.length} Members Banned`,
            description: bans.map(ban => `**Tag**: \`${ban.userTag}\` \n**ID**: \`${ban.userId}\`\n**Reason**: \`${ban.reason}\``).join('\n\n'),
            color: 0x900000,
            footer: { text: `Banned by ${executor.tag}`, iconURL: executor.displayAvatarURL({ dynamic: true }) },
            timestamp: Date.now()
        })]
    })
    recentBans.delete(executorId);
}
async function handleban(ban, action) {
    const filepath = "Extravariables\\commandsbans.json"
    let bans = load(filepath);
    const user = ban.user
    const banlogChannel = await ban.guild.channels.fetch(guildChannelMap[ban.guild.id].modChannels.banlogChannel);
    const auditLogs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 10 });
    const banEntry = auditLogs.entries.find(entry => entry.target.id === user.id);
    const executorId = banEntry.executor.id;
    const newBanData = {
        user: user,
        userTag: user.tag,
        userId: user.id,
        reason: banEntry.reason || "No reason provided."
    };
    const existingEntry = recentBans.get(executorId);
    if (!banEntry) {
        console.log(`Audit log entry not found for ban of ${user.tag}.`);
        return;
    }
    if (!banlogChannel) return;
    switch (action) {
        case 'add':
            if (bans.includes(user.id)) {
                save(filepath, [])
                return;
            }
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
            break;
        case 'remove': {
            bans = await getPunishments(user, ban.guild)
            const embed = new EmbedBuilder({
                color: 0x309eff,
                title: 'A member was unbanned',
                thumbnail: user.displayAvatarURL({ dynamic: true }),
                description: [
                    `**User**: ${user}`,
                    `**Tag**: \`${user.tag}\``,
                    `**Id**: \`${user.id}\`\n`,
                    `**Reason**: \`${bans.length > 0 ? `Ban Command: ${bans[0].reason}` : 'No reasons provided'}\``
                ].join('\n'),
                timestamp: Date.now()
            })
            banlogChannel.send({ embeds: [embed] });
        }

    }
}
export function guildBanAdd(ban) {
    handleban(ban, 'add')
}
export function guildBanRemove(ban) {
    handleban(ban, 'remove')
}