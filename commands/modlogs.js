import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';
import logRecentCommand from '../Logging/recentCommands.js';
import { getPunishments } from '../Database/databaseFunctions.js';

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );
//set log colors
const LOG_COLORS = {
    Warn: 0xffcc00,
    Mute: 0xff4444,
    default: 0x888888
};

function calculateWarnCounts(logs) {
    let warnCount = 0;
    const sortedForCalculation = [...logs];

    return sortedForCalculation.map(log => {
        // Only count active warnings that are of type 'Warn'
        // This logic defines what "warns at log time" means.
        if (log.type === 'Warn' && log.active) {
            warnCount++;
        }
        return { ...log, warnCountAtThisTime: warnCount };
    });
}
//define and build embed template
const buildLogEmbed = async (interaction, log, idx, totalLogs, targetUser) => {
    const moderator = await interaction.client.users.fetch(log.moderatorId);
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
        { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: false },
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
            text: `Staff: ${moderator.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`,
            iconURL: moderator.displayAvatarURL({ dynamic: true })
        });
};
const buildButtons = (idx, totalLogs, targetUserId, isDeletable, logId, logType, timestamp) => {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(`modlog_prev_${targetUserId}_${idx}_${timestamp}`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx === 0),
        new ButtonBuilder()
            .setCustomId(`modlog_next_${targetUserId}_${idx}_${timestamp}`)
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx >= totalLogs - 1)
    ];

    if (isDeletable) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`modlog_del_${logId}_${logType}_${targetUserId}_${idx}_${timestamp}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
        );
    }
    return new ActionRowBuilder().addComponents(buttons);
};

export async function execute(interaction) {
    // get user, moderator, and database moderator
    const targetUser = interaction.options.getUser('user');
    const moderatorUser = interaction.user;
    const moderatorMember = interaction.member;

    if (!moderatorMember) {
        return interaction.reply({ content: "Error: Could not determine your permissions.", ephemeral: true });
    }
    //define isAdmin for ease of reading
    const isAdmin = moderatorMember.permissions.has(PermissionsBitField.Flags.Administrator);

    // Fetch all logs only
    let allLogs = await getPunishments(targetUser.id);
    allLogs = calculateWarnCounts(allLogs); // This function now returns the re-sorted array

    //return early with no modlogs found
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

    const currentIndex = 0;
    const currentLog = allLogs[currentIndex];

    // Log the command usage
    logRecentCommand(`Modlogs command used by ${moderatorUser.tag} for user ${targetUser.tag}`);
    
    const timestamp = Date.now();

    //send embed
    await interaction.reply({
        embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length, targetUser)],
        components: [buildButtons(currentIndex, allLogs.length, targetUser.id, isAdmin && currentLog.active, currentLog.id, currentLog.type, timestamp)],
        ephemeral: false
    });
}
