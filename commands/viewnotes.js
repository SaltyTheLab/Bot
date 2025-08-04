import {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    PermissionFlagsBits
} from 'discord.js';
import { viewNotes, deleteNote } from '../Database/databaseFunctions.js';

export const data = new SlashCommandBuilder()
    .setName('note_show')
    .setDescription('View the notes of a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user').setRequired(true)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('target');
    const mod = interaction.user;

    // Ensure viewNotes is awaited if it's async
    const notes =  viewNotes(target.id);
    const allnotes = notes.sort((a, b) => b.timestamp - a.timestamp);

    if (!allnotes.length) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xa9a900)
                    .setDescription('No notes found for that user')
            ]
        });
    }

    let currentIndex = 0;

    const buildEmbed = (index) => {
        const note = allnotes[index];
        const formattedDate = new Date(note.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'CST'
        });

        return new EmbedBuilder()
            .setColor(0xdddddd)
            .setThumbnail(target.displayAvatarURL())
            .setDescription([
                `<@${target.id}> notes |  \`${index + 1} of ${allnotes.length}\``,
                `> ${note.note}`
            ].join('\n'))
            .setFooter({
                text: `${mod.tag} | ${formattedDate}`,
                iconURL: mod.displayAvatarURL({ dynamic: true })
            });
    };

    const buildButtons = (index) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_note')
                .setLabel('◀️ prev')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === 0),

            new ButtonBuilder()
                .setCustomId('next_note')
                .setLabel('▶️ next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === allnotes.length - 1),

            new ButtonBuilder()
                .setCustomId('delnote')
                .setLabel('🗑️ delete')
                .setStyle(ButtonStyle.Danger)
        );
    };

    await interaction.reply({
        embeds: [buildEmbed(currentIndex)],
        components: [buildButtons(currentIndex)]
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60_000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        const note = allnotes[currentIndex];

        if (i.customId === 'next_note') {
            currentIndex++;
        } else if (i.customId === 'prev_note') {
            currentIndex--;
        } else if (i.customId === 'delnote') {
            deleteNote(note.id);
            allnotes.splice(currentIndex, 1);

            if (!allnotes.length) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xdddddd)
                            .setDescription(`All notes for ${target.tag} have been deleted.`)
                    ],
                    components: []
                });
                return collector.stop();
            }

            if (currentIndex >= allnotes.length) {
                currentIndex = allnotes.length - 1;
            }
        }

        await interaction.editReply({
            embeds: [buildEmbed(currentIndex)],
            components: [buildButtons(currentIndex)]
        });
    });

    collector.on('end', async () => {
        const disabledRow = buildButtons(currentIndex);
        disabledRow.components.forEach(btn => btn.setDisabled(true));

        await interaction.editReply({ components: [disabledRow] });
    });
}
