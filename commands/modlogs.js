import { getPunishments, getUser } from '../Database/databaseAndFunctions.js';
async function buildLogEmbed(api, targetUser, log, idx, totalLogs) {
    const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const user = await api.users.get(targetUser)
    const moderator = await api.users.get(log.moderator)
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
    const mins = Math.round(log.duration / 60000);
    const hours = Math.floor(mins / 60);
    const thumbnail = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    const modthumbnail = `https://cdn.discordapp.com/avatars/${moderator.id}/${moderator.avatar}.png`
    return {
        color: LOG_COLORS[log.type],
        thumbnail: { url: thumbnail },
        fields: [
            { name: 'Member', value: `<@${log.userId}>`, inline: true },
            { name: 'Type', value: `\`${log.type}\``, inline: true },
            ...log.duration ? [{ name: 'Duration', value: `\`${hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${mins} minute${mins !== 1 ? 's' : ''}`}\``, inline: false }] : [],
            { name: 'Reason', value: `\`${log.reason}\``, inline: false },
            { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: true },
            { name: 'Log Status', value: log.active == 1 ? '✅ Active' : '❌ Inactive/cleared', inline: true },
            { name: 'Channel', value: `<#${log.channel}>\n\n [Event Link](${log.refrence})`, inline: false }
        ],
        footer: { text: `Staff: ${moderator.username} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`, icon_url: modthumbnail }
    }
};
export default {
    data: {
        name: 'modlogs',
        description: 'View a user’s moderation history.',
        default_member_permission: 1 << 8,
        contexts: 0,
        options: [{ name: 'target', description: 'The user to view', required: true, type: 6 }]
    },
    async execute({ interaction, api }) {
        const targetUser = interaction.data.options[0].value
        const isAdmin = (BigInt(interaction.member.permissions) & 0x8n) === 0x8n;
        const usercheck = await getUser({ userId: targetUser, guildId: interaction.guild_id, modflag: true });
        const embed = { color: 0x8d0b0b, description: `❌ <@${targetUser}> does not exist in Database!` };
        let allLogs = await getPunishments(targetUser, interaction.guild_id);
        if (!usercheck) return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] });
        else if (!allLogs.length) { embed.description = `⚠️ No modlogs found for <@${targetUser}>.`; embed.color = 0xf58931; return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] }); }
        let currentIndex = 0;
        const buttons = [
            { type: 2, custom_id: `modlog-prev-${targetUser}-${currentIndex}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
            { type: 2, custom_id: `modlog-next-${targetUser}-${currentIndex}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 },
            isAdmin ? { type: 2, custom_id: `modlog-del-${targetUser}-${currentIndex}`, label: 'Delete', style: 4, disabled: false } : []
        ];
        let currentLog = allLogs[currentIndex];
        await api.interactions.reply(interaction.id, interaction.token, {
            embeds: [await buildLogEmbed(api, targetUser, currentLog, currentIndex, allLogs.length)],
            components: [{ type: 1, components: buttons }]
        });
    }
}
