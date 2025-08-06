import { ButtonBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
//set log colors
const LOG_COLORS = {
    Warn: 0xffcc00,
    Mute: 0xff4444,
    Ban: 0xd1b1bf
};
//define and build embed template
export async function buildLogEmbed(interaction, log, idx, totalLogs) {
    const targetUser = await interaction.client.users.fetch(log.userId);
    const moderator = await interaction.client.users.fetch(log.moderatorId);
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    const fields = [
        { name: 'Member', value: `<@${log.userId}>`, inline: true },
        { name: 'Type', value: `\`${log.type}\``, inline: true },
        { name: 'Channel', value: `<#${log.channel}>`, inline: false },
        { name: 'Reason', value: `\`${log.reason || 'No reason provided'}\``, inline: false },
        { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: false },
    ];
    //add mute duration if log type is mute
    if (log.type === 'Mute' && log.duration) {
        const totalMinutes = Math.round(log.duration / 60000); // convert ms to minutes
        const hours = Math.floor(totalMinutes / 60);

        let durationString;
        if (hours > 0) {
            durationString = `${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            durationString = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
        }
        fields.push({ name: 'Duration', value: `\`${durationString}\``, inline: true });
    }
    fields.push({ name: 'Log Status', value: log.active ? '✅ Active' : '❌ Inactive/cleared', inline: true });

    return new EmbedBuilder()
        .setColor(LOG_COLORS[log.type])
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(fields)
        .setFooter({
            text: `Staff: ${moderator.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`,
            iconURL: moderator.displayAvatarURL({ dynamic: true })
        });
};
export async function buildButtons(idx, totalLogs, targetUserId, isDeletable, logId, logType, disabled = false) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(`modlog_prev_${targetUserId}_${idx}`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx === 0 || disabled),
        new ButtonBuilder()
            .setCustomId(`modlog_next_${targetUserId}_${idx}`)
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx >= totalLogs - 1 || disabled)
    ];

    if (isDeletable) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`modlog_del_${targetUserId}_${logId}_${logType}_${idx}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled)
        );
    }
    return new ActionRowBuilder().addComponents(...buttons);
};
export async function buildNoteEmbed(interaction, index, currentNote, length) {

    const target = await interaction.client.users.fetch(currentNote.userId);
    const mod = await interaction.client.users.fetch(currentNote.moderatorId);
    const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    return new EmbedBuilder()
        .setColor(0xdddddd)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setDescription([
            `${target} notes |  \`${index + 1} of ${length}\``,
            `> ${currentNote.note}`
        ].join('\n'))
        .setFooter({
            text: `${mod.tag} | ${formattedDate}`,
            iconURL: mod.displayAvatarURL({ dynamic: true })
        });
};
export async function buildNoteButtons(target, index, currentNote, allnotes, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`note_prev_${target}_${index}`)
            .setLabel('◀️ prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0 || disabled),

        new ButtonBuilder()
            .setCustomId(`note_next_${target}_${index}`)
            .setLabel('▶️ next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === allnotes - 1 || disabled),

        new ButtonBuilder()
            .setCustomId(`note_delete_${target}_${index}_${currentNote.id}`)
            .setLabel('🗑️ delete')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
};