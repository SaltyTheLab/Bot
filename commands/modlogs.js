import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';

import { getWarns, getMutes, deleteMute, deleteWarn } from '../Logging/database.js'; // adjust the import path

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

export async function execute(interaction) {
    const user = interaction.options.getUser('user');

    const warns = await getWarns(user.id);
    const mutes = await getMutes(user.id);

    // Combine and sort logs by timestamp
    const allLogs = [
        ...warns.map(log => ({ ...log, type: 'Warn' })),
        ...mutes.map(log => ({ ...log, type: 'Mute' }))
    ].sort((a, b) => b.timestamp - a.timestamp); // newest first

    if (allLogs.length === 0) {
        return interaction.reply({
            content: `No modlogs found for ${user.tag}.`,
            ephemeral: true
        });
    }
    let warnCount = 0;
    for (const log of allLogs) {
        if (log.type === 'Warn') warnCount++;
        log.warnCountAtThisTime = warnCount;
    }

    let currentIndex = 0;

    const formatTimestamp = (msTimestamp) => {
        const seconds = Math.floor(msTimestamp / 1000);
        return `<t:${seconds}:F>`; // 'F' for full date
    };

    const getEmbed = (index) => {
        const log = allLogs[index];
        const embed = new EmbedBuilder()
            .setColor(log.type === 'Warn' ? 0xffcc00 : 0xff4444)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Member:', value: `<@${user.id}>`, inline: false },
                { name: 'Type', value: `\`${log.type}\``, inline: true },
                { name: 'Reason', value: `\`${log.reason}\`` || 'No reason provided', inline: false },
                { name: 'Moderator ID', value: `<@${log.moderatorId}>`, inline: false },
                { name: 'Warns at warn:', value: `\`${log.warnCountAtThisTime}\``, inline: false },
                ...(log.type === 'Mute'
                    ? [{ name: 'Duration', value: `\`${Math.round(log.duration / 60000)} minutes\``, inline: true }]
                    : []),
                { name: 'Status', value: log.active ? '✅ Active' : '❌ Inactive', inline: true },
                { name: 'Timestamp', value: formatTimestamp(log.timestamp), inline: false },
            )
            .setFooter({ text: `Log ${index + 1} of ${allLogs.length}` });



        return embed;
    };



    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    //post interaction buttons, admin check for delete button
    const getButtons = (index) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('prev_log')
                .setLabel('⬅️ Back')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === 0),
            new ButtonBuilder()
                .setCustomId('next_log')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === allLogs.length - 1)
        ];

        if (isAdmin) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('dellog')
                    .setLabel('Delete')
                    .setStyle(ButtonStyle.Danger) // red button
            );
        }

        return new ActionRowBuilder().addComponents(buttons);
    };

    const message = await interaction.reply({
        embeds: [getEmbed(currentIndex)],
        components: [getButtons(currentIndex)],
        fetchReply: true,
        ephemeral: false // public response
    });

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id || (isAdmin && i.user.id !== interaction.user.id),
        time: 60_000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        if (i.customId === 'next_log') currentIndex++;
        else if (i.customId === 'prev_log') currentIndex--;
        else if (i.customId === 'dellog') {
            if (!isAdmin) {
                return i.followUp({ content: 'You do not have permission to delete logs.', ephemeral: true });
            }

            // Delete the log from DB
            const log = allLogs[currentIndex];

            if (log.type === 'Warn') {
                
                await deleteWarn(log.id);
            } else if (log.type === 'Mute') {
                await deleteMute(log.id);
            }

            // Remove log from array so UI updates
            allLogs.splice(currentIndex, 1);

            // If no logs left
            if (allLogs.length === 0) {
                await interaction.editReply({
                    content: `All modlogs for ${user.tag} have been deleted.`,
                    embeds: [],
                    components: []
                });
                return collector.stop();
            }

            // Adjust currentIndex if needed
            if (currentIndex >= allLogs.length) currentIndex = allLogs.length - 1;
        }

        await interaction.editReply({
            embeds: [getEmbed(currentIndex)],
            components: [getButtons(currentIndex)]
        });
    });

    collector.on('end', async () => {
        const disabledRow = getButtons(currentIndex);
        disabledRow.components.forEach(btn => btn.setDisabled(true));

        await interaction.editReply({
            components: [disabledRow]
        });
    });
}

