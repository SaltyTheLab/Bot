import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { viewNotes } from '../Database/databaseFunctions.js';
import { buildNoteButtons, buildEmbed } from '../utilities/buildnoteembeds.js';
export const data = new SlashCommandBuilder()
    .setName('note_show')
    .setDescription('View the notes of a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user').setRequired(true)
    );

export async function execute(interaction) {
    const id = interaction.options.getUser('target');
    const target = await interaction.client.users.fetch(id);

    const allnotes = await viewNotes(target.id);

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
    const currentnote = allnotes[currentIndex]

    await interaction.reply({
        embeds: [await buildEmbed(interaction, target, currentIndex, currentnote, allnotes.length)],
        components: [await buildNoteButtons(target.id, currentIndex, currentnote, allnotes.length)]
    });
}
