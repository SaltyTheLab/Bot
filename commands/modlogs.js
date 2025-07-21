import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';

import { getWarns, getMutes, deleteMute, deleteWarn } from '../Logging/databasefunctions.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

export async function execute(interaction) {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

    const [warns, mutes] = await Promise.all([getWarns(user.id), getMutes(user.id)]);
    let allLogs = [
        ...warns.map(log => ({ ...log, type: 'Warn' })),
        ...mutes.map(log => ({ ...log, type: 'Mute' }))
    ].sort((a, b) => b.timestamp - a.timestamp);

    if (!allLogs.length) {
        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xFFFF00)
                .setAuthor({ name: '⚠️ No modlogs found for that user.' })
            ]
        });
    }

    // Add warn count at each step
    let warnCount = 0;
    allLogs.forEach(log => {
        if (log.type === 'Warn') warnCount++;
        log.warnCountAtThisTime = warnCount;
    });

    let currentIndex = 0;

    async function buildEmbed(index) {
        const log = allLogs[index];
        const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'CST'
        });

        let modUser;
        try {
            modUser = await interaction.guild.members.fetch(log.moderatorId);
        } catch (e) {
            console.error(`Could not fetch moderator ${log.moderatorId}:`, e);
            modUser = null;
        }

        const moderatorTag = modUser?.user?.tag ?? 'Unknown';
        const moderatorNick = modUser?.nickname ?? moderatorTag;
        const moderatorAvatar = modUser?.displayAvatarURL({ dynamic: true }) ?? null;

        const embed = new EmbedBuilder()
            .setColor(log.type === 'Warn' ? 0xffcc00 : 0xff4444)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Member:', value: `<@${user.id}>`, inline: false },
                { name: 'Type', value: `\`${log.type}\``, inline: true },
                { name: 'Reason', value: `\`${log.reason || 'No reason provided'}\``, inline: false },
                { name: 'Warns at warn:', value: `\`${log.warnCountAtThisTime}\``, inline: false },
                ...(log.type === 'Mute'
                    ? [{ name: 'Duration:', value: `\`${Math.round(log.duration / 60000)} minutes\``, inline: true }]
                    : []),
                { name: 'Warn Status:', value: log.active ? '✅ Active' : '❌ Inactive/cleared', inline: true },
            )
            .setFooter({
                text: `Staff: ${moderatorNick} | Log ${index + 1} of ${allLogs.length} | ${formattedDate}`,
                iconURL: moderatorAvatar
            });

        return embed;
    }

    function buildButtons(index) {
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
                    .setStyle(ButtonStyle.Danger)
            );
        }

        return new ActionRowBuilder().addComponents(buttons);
    }

    // Initial reply
    await interaction.reply({
        embeds: [await buildEmbed(currentIndex)],
        components: [buildButtons(currentIndex)]
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id || (isAdmin && i.user.id !== interaction.user.id),
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
                if (!isAdmin) {
                    return i.followUp({
                        content: 'You do not have permission to delete logs.',
                        ephemeral: true
                    });
                }

                if (log.type === 'Warn') {
                    await deleteWarn(log.id);
                    logRecentCommand(`warn log deleted from ${user.tag} Admin: ${interaction.user.tag}`);
                } else if (log.type === 'Mute') {
                    await deleteMute(log.id);
                    logRecentCommand(`mute log deleted from ${user.tag} Admin: ${interaction.user.tag}`);
                }

                allLogs.splice(currentIndex, 1);

                if (!allLogs.length) {
                    await interaction.editReply({
                        content: `All modlogs for ${user.tag} have been deleted.`,
                        embeds: [],
                        components: []
                    });
                    return collector.stop();
                }

                if (currentIndex >= allLogs.length) currentIndex = allLogs.length - 1;
                break;
        }
        logRecentCommand(`${interaction.user.tag} viewed modlogs for ${user.tag}`);
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