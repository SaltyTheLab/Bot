import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { editPunishment, getPunishments, getUser } from '../Database/databaseAndFunctions.js';
async function buildLogEmbed(interaction, targetUser, log, idx, totalLogs) {
    const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const moderator = await interaction.client.users.fetch(log.moderatorId);
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
    const mins = Math.round(log.duration / 60000);
    const hours = Math.floor(mins / 60);
    return new EmbedBuilder({
        color: LOG_COLORS[log.type],
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: [
            { name: 'Member', value: `<@${log.userId}>`, inline: true },
            { name: 'Type', value: `\`${log.type}\``, inline: true },
            ...log.duration ? [{ name: 'Duration', value: `\`${hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${mins} minute${mins !== 1 ? 's' : ''}`}\``, inline: false }] : [],
            { name: 'Reason', value: `\`${log.reason}\``, inline: false },
            { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: true },
            { name: 'Log Status', value: log.active == 1 ? '✅ Active' : '❌ Inactive/cleared', inline: true },
            { name: 'Channel', value: `<#${log.channel}>\n\n [Event Link](${log.refrence})`, inline: false }
        ],
        footer: { text: `Staff: ${moderator.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`, iconURL: moderator.displayAvatarURL({ dynamic: true }) }
    })
};
export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );
export async function execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const fiveMinutesInMs = 5 * 60 * 1000;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const usercheck = await getUser({ userId: targetUser.id, guildId: interaction.guild.id, modflag: true });
    let allLogs = await getPunishments(targetUser.id, interaction.guild.id);
    if (!usercheck) return interaction.reply({ embeds: [new EmbedBuilder({ color: 0x8d0b0b, author: { name: `❌ ${targetUser.tag} does not exist in Database!` } })] });
    else if (!allLogs.length) return interaction.reply({ embeds: [new EmbedBuilder({ color: 0xf58931, author: { name: `⚠️ No modlogs found for ${targetUser.tag}.` } })] });
    let currentIndex = 0;
    let currentLog = allLogs[currentIndex];
    const initialResponse = await interaction.reply({
        embeds: [await buildLogEmbed(interaction, targetUser, currentLog, currentIndex, allLogs.length)],
        components: [{
            type: 1,
            components:
                [{ type: 2, custom_id: `prev`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                { type: 2, custom_id: `next`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 },
                isAdmin ? { type: 2, custom_id: `del`, label: 'Delete', style: 4, disabled: false } : []]
        }],
        withResponse: true
    });
    const collector = initialResponse.resource.message.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: fiveMinutesInMs });
    let replyMessage = initialResponse.resource.message;
    collector.on('collect', async i => {
        await i.deferUpdate();
        switch (i.customId) {
            case 'del':
                await editPunishment({ userId: targetUser.id, guildId: interaction.guild.id, id: currentLog._id })
                allLogs = await getPunishments(targetUser.id, interaction.guild.id);
                if (allLogs.length < 1) {
                    await replyMessage.edit({ embeds: [new EmbedBuilder({ description: `All logs for ${targetUser} deleted.` })], components: [] });
                    return;
                }
                currentIndex = Math.min(currentIndex, allLogs.length - 1)
                break;
            default: currentIndex = i.customId == 'next' ? Math.min(allLogs.length - 1, currentIndex + 1)
                : Math.max(0, currentIndex - 1)
                break;
        }
        currentLog = allLogs[currentIndex];
        replyMessage = await replyMessage.edit({
            embeds: [await buildLogEmbed(interaction, targetUser, currentLog, currentIndex, allLogs.length)],
            components: [{
                type: 1,
                components: [
                    { type: 2, custom_id: `prev`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                    { type: 2, custom_id: `next`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 },
                    ...isAdmin ? [{ type: 2, custom_id: `del`, label: 'Delete', style: 4, disabled: false }] : []
                ]
            }]
        })
    });
    collector.on('end', async () => {
        if (allLogs.length > 0) {
            replyMessage.edit({
                components: [{
                    type: 1,
                    components: [
                        { type: 2, custom_id: `prev`, label: '⬅️ Back', style: 2, disabled: true },
                        { type: 2, custom_id: `next`, label: 'Next ➡️', style: 2, disabled: true },
                        ...isAdmin ? [{ type: 2, custom_id: `del`, label: 'Delete', style: 4, disabled: true }] : []
                    ]
                }]
            })
        }
    });
}