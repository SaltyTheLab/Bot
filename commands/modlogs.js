import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';

import { deleteMute, deleteWarn, getPunishments } from '../Database/databasefunctions.js'; // Removed getActiveWarns
import { logRecentCommand } from '../Logging/recentcommands.js';

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

const LOG_COLORS = {
    Warn: 0xffcc00,
    Mute: 0xff4444,
    default: 0x888888
};

function calculateWarnCounts(logs) {
    let warnCount = 0;
    // Iterate in chronological order to correctly calculate cumulative active warnings
    // assuming 'logs' is already sorted by timestamp ascending for this calculation
    // OR if logs are sorted descending, adjust the logic to count backwards or sort temporary.
    // For modlogs usually displayed newest first, if calculation needs oldest first, sort then map, then re-sort.
    // Given previous context, allLogs is sorted descending, so we need to sort ascending for the cumulative count.
    const sortedForCalculation = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    
    return sortedForCalculation.map(log => {
        // Only count active warnings that are of type 'Warn'
        // This logic defines what "warns at log time" means.
        if (log.type === 'Warn' && log.active) { 
            warnCount++;
        }
        return { ...log, warnCountAtThisTime: warnCount };
    }).sort((a, b) => b.timestamp - a.timestamp); // Sort back to newest first for display
}

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const moderatorUser = interaction.user;
    const moderatorMember = await interaction.guild.members.fetch(moderatorUser.id).catch(() => null);
    
    if (!moderatorMember) {
        return interaction.reply({ content: "Error: Could not determine your permissions.", ephemeral: true });
    }

    const isAdmin = moderatorMember.permissions.has(PermissionsBitField.Flags.Administrator);

    // Fetch all logs only
    let allLogs = await getPunishments(targetUser.id);
    
    // Sort logs once by timestamp (newest first for display) and calculate running warn counts
    allLogs.sort((a, b) => b.timestamp - a.timestamp); 
    allLogs = calculateWarnCounts(allLogs); // This function now returns the re-sorted array

    if (!allLogs.length) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(LOG_COLORS.default)
                    .setAuthor({ name: `⚠️ No modlogs found for ${targetUser.tag}.` })
            ],
            ephemeral: true
        });
    }

    let currentIndex = 0;

    const buildButtons = (idx, totalLogs) => {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('prev_log')
                .setLabel('⬅️ Back')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(idx === 0),
            new ButtonBuilder()
                .setCustomId('next_log')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(idx >= totalLogs - 1)
        ];

        if (isAdmin) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('dellog')
                    .setLabel('Delete')
                    .setStyle(ButtonStyle.Danger)
            );
        }
        return new ActionRowBuilder().addComponents(buttons);
    };

    const buildLogEmbed = async (log, idx, totalLogs, targetUser, moderatorMember) => {
        const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'CST'
        });

        const fields = [
            { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Type', value: `\`${log.type}\``, inline: true },
            { name: 'Channel', value: `<#${log.channel}>`, inline: false },
            { name: 'Reason', value: `\`${log.reason || 'No reason provided'}\``, inline: false },
            { name: 'Warns at Log Time', value: `\`${log.warnCountAtThisTime}\``, inline: false },
        ];

        if (log.type === 'Mute') {
            fields.push({ name: 'Duration', value: `\`${Math.round(log.duration / 60000)} minutes\``, inline: true });
        }
        fields.push({ name: 'Log Status', value: log.active ? '✅ Active' : '❌ Inactive/cleared', inline: true });

        return new EmbedBuilder()
            .setColor(LOG_COLORS[log.type] ?? LOG_COLORS.default)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(fields)
            .setFooter({
                text: `Staff: ${moderatorMember.displayName || moderatorMember.user.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`,
                iconURL: moderatorUser.displayAvatarURL({ dynamic: true })
            });
    };

    await interaction.reply({
        embeds: [await buildLogEmbed(allLogs[currentIndex], currentIndex, allLogs.length, targetUser, moderatorMember)],
        components: [buildButtons(currentIndex, allLogs.length)],
        ephemeral: false
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === moderatorUser.id || (isAdmin && i.user.id !== moderatorUser.id),
        time: 5 * 60 * 1000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        const currentLog = allLogs[currentIndex];

        switch (i.customId) {
            case 'next_log':
                currentIndex = Math.min(currentIndex + 1, allLogs.length - 1);
                break;
            case 'prev_log':
                currentIndex = Math.max(currentIndex - 1, 0);
                break;
            case 'dellog':
                try {
                    const deleteFn = currentLog.type === 'Warn' ? deleteWarn : deleteMute;
                    await deleteFn(currentLog.id);
                    logRecentCommand(`${currentLog.type} log deleted for ${targetUser.tag} | Admin: ${moderatorUser.tag} | Log ID: ${currentLog.id}`);

                    // Remove the deleted log from the array
                    allLogs.splice(currentIndex, 1);

                    // Re-calculate warn counts for the remaining logs after deletion
                    // This function also re-sorts, so allLogs is ready for display
                    allLogs = calculateWarnCounts(allLogs);

                    if (!allLogs.length) {
                        await i.editReply({
                            content: `All modlogs for ${targetUser.tag} have been deleted.`,
                            embeds: [],
                            components: []
                        });
                        return collector.stop();
                    }

                    if (currentIndex >= allLogs.length) {
                        currentIndex = allLogs.length - 1;
                    }

                    await i.followUp({ content: `Successfully deleted ${currentLog.type} log (ID: ${currentLog.id}).`, ephemeral: true });

                } catch (error) {
                    console.error(`Error deleting log ${currentLog.id}:`, error);
                    await i.followUp({ content: `Failed to delete log: ${error.message}`, ephemeral: true });
                }
                break;
        }

        await i.editReply({
            embeds: [await buildLogEmbed(allLogs[currentIndex], currentIndex, allLogs.length, targetUser, moderatorMember)],
            components: [buildButtons(currentIndex, allLogs.length)]
        });
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const disabledRow = buildButtons(currentIndex, allLogs.length);
            disabledRow.components.forEach(btn => btn.setDisabled(true));

            await interaction.editReply({
                components: [disabledRow]
            }).catch(e => console.error("Failed to disable buttons on collector end:", e));
        }
        logRecentCommand(`${moderatorUser.tag} ended modlog session for ${targetUser.tag}`);
    });
}