import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';

import { deleteMute, deleteWarn, getActiveWarns, getPunishments } from '../Database/databasefunctions.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

export async function execute(interaction) {
    const user = interaction.options.getUser('user');
    const modUser = interaction.user;
    const member = await interaction.guild.members.fetch(modUser.id)
    const isAdmin = await member.permissions.has(PermissionsBitField.Flags.Administrator);
    const activeWarnings = await getActiveWarns(user.id)
    const logs = await getPunishments(user.id);
    let allLogs = logs.sort((a, b) => b.timestamp - a.timestamp);
    const logColors = {
        Warn: 0xffcc00,
        Mute: 0xff4444
    };

    //embed and button functions
    const buildEmbed = async (index) => {
        const log = allLogs[index];
        const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'CST'
        });

        return new EmbedBuilder()
            .setColor(logColors[log.type] ?? 0x888888)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Member', value: `<@${user.id}>`, inline: true },
                { name: 'Type', value: `\`${log.type}\``, inline: true },
                { name: 'channel', value: `<#${log.channel}>`, inline: false },
                { name: 'Reason', value: `\`${log.reason || 'No reason provided'}\``, inline: false },
                { name: 'Warns at warn', value: `\`${activeWarnings[index].weight}\``, inline: false },
                ...(log.type === 'Mute'
                    ? [{ name: 'Duration', value: `\`${Math.round(log.duration / 60000)} minutes\``, inline: true }]
                    : []),
                { name: 'Warn Status', value: log.active ? '✅ Active' : '❌ Inactive/cleared', inline: true }
            )
            .setFooter({
                text: `Staff: ${member.nickname} | Log ${index + 1} of ${allLogs.length} | ${formattedDate}`,
                iconURL: modUser.displayAvatarURL({ dynamic: true })
            });
    };
    const buildButtons = (index) => {
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
                .setDisabled(index >= allLogs.length - 1)
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

    if (!allLogs.length) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setAuthor({ name: '⚠️ No modlogs found for that user.' })
            ]
        });
    }

    // Track warn count per log
    let warnCount = 0;
    allLogs = allLogs.map(log => {
        if (log.type === 'Warn') warnCount++;
        return { ...log, warnCountAtThisTime: warnCount };
    });

    let currentIndex = 0;

    // Send initial log embed
    await interaction.reply({
        embeds: [await buildEmbed(currentIndex)],
        components: [buildButtons(currentIndex)]
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === modUser.id || (isAdmin && i.user.id !== modUser.id),
        time: 60_000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        const log = allLogs[currentIndex];

        switch (i.customId) {
            case 'next_log':
                currentIndex++;
                break;
            case 'prev_log':
                currentIndex--;
                break;
            case 'dellog':
                const deleteFn = log.type === 'Warn' ? deleteWarn : deleteMute;
                deleteFn(log.id);
                logRecentCommand(`${log.type} log deleted from ${user.tag} | Admin: ${modUser.tag}`);


                allLogs.splice(currentIndex, 1);

                if (!allLogs.length) {
                    await interaction.editReply({
                        content: `All modlogs for ${user.tag} have been deleted.`,
                        embeds: [],
                        components: []
                    });
                    return collector.stop();
                }

                if (currentIndex >= allLogs.length) {
                    currentIndex = allLogs.length - 1;
                }
                break;
        }

        logRecentCommand(`${modUser.tag} viewed modlogs for ${user.tag}`);

        await interaction.editReply({
            embeds: [await buildEmbed(currentIndex)],
            components: [buildButtons(currentIndex)]
        });
    });

    collector.on('end', async () => {
        const disabledRow = buildButtons(currentIndex);
        disabledRow.components.forEach(btn => btn.setDisabled(true));

        await interaction.editReply({
            components: [disabledRow]
        });
    });
}