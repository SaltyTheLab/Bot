import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
export async function buildEmbed(interaction, target, index, currentNote, length) {
    const mod = await interaction.client.users.fetch(currentNote.moderatorId)
    const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    return new EmbedBuilder()
        .setColor(0xdddddd)
        .setThumbnail(target.displayAvatarURL({dynamic: true}))
        .setDescription([
            `${target} notes |  \`${index + 1} of ${length}\``,
            `> ${currentNote.note}`
        ].join('\n'))
        .setFooter({
            text: `${mod.tag} | ${formattedDate}`,
            iconURL: mod.displayAvatarURL({ dynamic: true })
        });
};

export async function buildNoteButtons(target, index, currentNote, allnotes) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`note_prev_${target}_${index}`)
            .setLabel('◀️ prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),

        new ButtonBuilder()
            .setCustomId(`note_next_${target}_${index}`)
            .setLabel('▶️ next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === allnotes - 1),

        new ButtonBuilder()
            .setCustomId(`note_delete_${target}_${index}_${currentNote.id}`)
            .setLabel('🗑️ delete')
            .setStyle(ButtonStyle.Danger)
    );
};