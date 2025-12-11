import { EmbedBuilder } from "discord.js";
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
    let bans = await load(filepath);
    const user = ban.user
    const banlogChannel = ban.guild.channels.cache.get(guildChannelMap[ban.guild.id].modChannels.banlogChannel);
    const banEntry = await ban.guild.bans.fetch({ user: ban.user.id, force: true });
    const executorId = banEntry.executor.id;
    const existingEntry = recentBans.get(executorId);
    if (!banlogChannel) return;
    switch (action) {
        case 'add':
            if (bans.includes(user.id)) { save(filepath, []); return; }
            if (existingEntry) {
                clearTimeout(existingEntry.timeout);
                existingEntry.bans.push({ user: user, userTag: user.tag, userId: user.id, reason: banEntry.reason || "No reason provided." });
                existingEntry.timeout = setTimeout(() => sendMassBanEmbed(executorId, banlogChannel), 3000);
            }
            recentBans.set(executorId, existingEntry ?? {
                executor: banEntry.executor,
                bans: [{ user: user, userTag: user.tag, userId: user.id, reason: banEntry.reason || "No reason provided." }],
                timeout: setTimeout(() => sendMassBanEmbed(executorId, banlogChannel), 3000)
            });
            break;
        case 'remove': {
            bans = await getPunishments(user.id, ban.guild)
            const ban = bans.filter(ban => ban.type == 'Ban')
            banlogChannel.send({
                embeds: [new EmbedBuilder({
                    color: 0x309eff,
                    title: 'A member was unbanned',
                    thumbnail: user.displayAvatarURL({ dynamic: true }),
                    description: `**User**: ${user}\n**Tag**: \`${user.tag}\`\n**Id**: \`${user.id}\`\n\n**Reason**: \`${`Ban Command: ${ban[0].reason}`}\``,
                    timestamp: Date.now()
                })]
            });
        }
    }
}
export async function guildBanAdd(ban) {
    handleban(ban, 'add')
}
export async function guildBanRemove(ban) {
    handleban(ban, 'remove')
}