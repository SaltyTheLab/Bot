import { ButtonBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
//set log colors
const LOG_COLORS = {
    Warn: 0xffcc00,
    Mute: 0xff4444,
    Ban: 0xd1b1bf
};
//define and build embed template
export async function buildLogEmbed(interaction, log, idx, totalLogs) {
    const [targetUser, moderator] = await Promise.all(
        [interaction.client.users.fetch(log.userId),
        interaction.client.users.fetch(log.moderatorId)
        ]);
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    const fields = [
        { name: 'Member', value: `<@${log.userId}>`, inline: true },
        { name: 'Type', value: `\`${log.type}\``, inline: true },
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
        fields.push({ name: 'Duration', value: `\`${durationString}\``, inline: false });
    }
    return new EmbedBuilder()
        .setColor(LOG_COLORS[log.type])
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(...fields,
            { name: 'Reason', value: `\`${log.reason}\``, inline: false },
            { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: true },
            { name: 'Log Status', value: log.active == 1 ? '✅ Active' : '❌ Inactive/cleared', inline: true },
            { name: 'Channel', value: `<#${log.channel}>\n\n [Event Link](${log.refrence})`, inline: false }
        )
        .setFooter({
            text: `Staff: ${moderator.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`,
            iconURL: moderator.displayAvatarURL({ dynamic: true })
        });
};
export async function buildButtons(idx, totalLogs, isDeletable, logId, disabled = false) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(`modlog-prev`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx === 0 || disabled),
        new ButtonBuilder()
            .setCustomId(`modlog-next`)
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx >= totalLogs - 1 || disabled)
    ];

    if (isDeletable) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`modlog-del-${logId}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled)
        );
    }
    return new ActionRowBuilder().addComponents(...buttons);
};
export async function buildNoteEmbed(interaction, index, currentNote, length) {
    console.log(currentNote.userId)
    const [target, mod] = await Promise.all(
        [interaction.client.users.fetch(currentNote.userId),
        interaction.client.users.fetch(currentNote.moderatorId)
        ]);
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
export async function buildNoteButtons(index, allnotes, id, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`note-prev`)
            .setLabel('◀️ prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0 || disabled),

        new ButtonBuilder()
            .setCustomId(`note-next`)
            .setLabel('▶️ next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index >= allnotes.length - 1 || disabled),

        new ButtonBuilder()
            .setCustomId(`note-del-${id}`)
            .setLabel('🗑️ delete')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
};